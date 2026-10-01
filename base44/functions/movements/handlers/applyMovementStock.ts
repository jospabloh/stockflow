import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { withRetry, isTransient } from '../../../shared/applyStock.ts';

// Un movimiento SIN stock_apply_state y creado hace más de esto es histórico
// (aplicado por el flujo anterior o con la marca perdida): no se reaplica nunca
// automáticamente porque duplicaría el efecto. Se reporta y se revisa a mano.
const LEGACY_WINDOW_MS = 30 * 60 * 1000;

const ACTIVE_STATES = ['pending', 'applied', 'failed'];
const ts = (v: unknown) => Date.parse(String(v || ''));

/**
 * Recuperación segura: devuelve un motivo (string) si NO se puede probar que ningún otro
 * proceso tocó el stock del producto desde que este movimiento dejó su marca 'pending';
 * null si es seguro decidir (reaplicar o solo marcar). Comparar valores (stock actual ==
 * stock_before / esperado) NO basta: otros movimientos pueden devolver el stock a ese mismo
 * valor (ABA) y el reintento duplicaría o marcaría en falso. Por eso, ante la duda, se
 * responde needs_review y se deja a revisión humana (los fallos pasados solo se reportan).
 */
// deno-lint-ignore no-explicit-any
async function recoveryBlocker(base44: any, movement: any, product: any, productWritten: boolean): Promise<string | null> {
  // stock_pending_at lo escribe la marca pending; si el esquema aún no lo tiene, created_date
  // (anterior a la marca) es una referencia más conservadora.
  const ref = ts(movement.stock_pending_at || movement.created_date);
  if (!Number.isFinite(ref)) return 'el movimiento no tiene marca de tiempo verificable';
  if (!productWritten) {
    const pu = ts(product.updated_date);
    if (Number.isFinite(pu) && pu > ref) {
      return `el producto se modificó (${product.updated_date}) después de la marca pendiente del movimiento`;
    }
  }
  // deno-lint-ignore no-explicit-any
  let others: any[];
  try {
    others = await withRetry(() => base44.asServiceRole.entities.Movement.filter({ product_id: movement.product_id }, '-updated_date', 500)) || [];
  } catch (e) {
    return `no se pudo verificar los movimientos del producto: ${(e as Error).message}`;
  }
  const touched = others.find((o) =>
    o.id !== movement.id &&
    (o.stock_applied === true || ACTIVE_STATES.includes(o.stock_apply_state)) &&
    Math.max(ts(o.updated_date) || 0, ts(o.created_date) || 0) > ref
  );
  if (touched) {
    return `otro movimiento del mismo producto (${touched.id}) cambió o intentó cambiar el stock después de este`;
  }
  return null;
}

/**
 * applyMovementStock — aplica el efecto de UN movimiento sobre Product.stock
 * EXACTAMENTE UNA VEZ.
 *
 * Es la única autoridad de la lógica de delta de inventario. Es idempotente:
 * usa la marca Movement.stock_applied para no aplicar dos veces. La pueden
 * invocar de forma síncrona los escritores (createMovementSafe, convert,
 * partialReturn, cancel, deliver) y la automatización syncProductStock.
 *
 * Reglas de delta (sobre el stock actual del producto):
 *   entry              → stock + quantity
 *   exit | return      → stock − quantity
 *   adjustment         → quantity   (valor ABSOLUTO, como indica la UI)
 * El stock nunca queda por debajo de 0.
 *
 * Robustez (fix stock-no-aplicado): escribe stock_apply_state='pending' +
 * stock_before ANTES de tocar el producto, reintenta (429/5xx/red) cada
 * escritura, y si encuentra un movimiento 'pending'/'failed' decide con
 * stock_before si el producto ya fue escrito (solo pone la marca) o no (aplica), PERO
 * solo si prueba que ningún otro movimiento/escritura tocó el producto desde la marca
 * pending (recoveryBlocker; comparar valores no basta por ABA); en cualquier otro caso
 * responde 409 needs_review sin tocar nada.
 * Anti lost-update: relee Product.stock justo antes de escribir (rebasa si cambió) y
 * cada reintento de Product.update relee primero (ya escrito -> solo marca; cambio de
 * tercero -> 409 needs_review); nunca sobrescribe a ciegas con un valor viejo.
 *
 * Autorización: igual que el resto de funciones internas — acepta CRON_SECRET
 * (scheduler / invocación service-role) o un usuario autenticado de su propio
 * tenant.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { movement_id, business_id } = body;

    if (!movement_id) {
      return Response.json({ success: false, error: 'movement_id is required' }, { status: 400 });
    }

    // ── Auth: CRON_SECRET (service-role) o usuario autenticado del tenant ──
    const cronSecretEnv = Deno.env.get('CRON_SECRET');
    const validCron = cronSecretEnv && (
      req.headers.get('x-cron-secret') === cronSecretEnv ||
      body?.['x-cron-secret'] === cronSecretEnv
    );

    // Aislamiento por tenant: SÓLO el CRON_SECRET marca la llamada como
    // service-role. Un usuario sin business_id (recién registrado, sin
    // negocio aún) ya NO se trata como service-role — eso era un bypass que
    // permitía aplicar movimientos de CUALQUIER tenant.
    const isServiceRole = Boolean(validCron);

    let user = null;
    if (!isServiceRole) {
      user = await base44.auth.me().catch(() => null);
      if (!user) {
        return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      if (!user.business_id) {
        return Response.json({ success: false, error: 'Forbidden: no business_id' }, { status: 403 });
      }
    }

    const movement = await base44.asServiceRole.entities.Movement.get(movement_id);
    if (!movement) {
      return Response.json({ success: false, error: 'Movement not found' }, { status: 404 });
    }

    if (!isServiceRole && movement.business_id && movement.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden: business_id mismatch' }, { status: 403 });
    }
    if (business_id && movement.business_id && movement.business_id !== business_id) {
      return Response.json({ success: false, error: 'Forbidden: business_id mismatch' }, { status: 403 });
    }

    // Idempotencia: si ya se aplicó, no hacer nada.
    if (movement.stock_applied === true) {
      return Response.json({ success: true, already_applied: true, product_id: movement.product_id });
    }

    if (!movement.product_id) {
      return Response.json({ success: true, skipped: 'no product_id' });
    }

    const product = await base44.asServiceRole.entities.Product.get(movement.product_id);
    if (!product) {
      return Response.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    // Defensa en profundidad: producto y movimiento deben ser del mismo tenant.
    if (movement.business_id && product.business_id && product.business_id !== movement.business_id) {
      return Response.json({ success: false, error: 'Forbidden: product/movement tenant mismatch' }, { status: 403 });
    }

    const qty = movement.quantity || 0;
    const stockNow = product.stock || 0;
    const compute = (base: number) => {
      let n = base;
      if (movement.type === 'entry') n += qty;
      else if (movement.type === 'exit' || movement.type === 'return') n -= qty;
      else if (movement.type === 'adjustment') n = qty; // fija el stock final de forma absoluta
      return n < 0 ? 0 : n;
    };
    if (!['entry', 'exit', 'return', 'adjustment'].includes(movement.type)) {
      return Response.json({ success: false, error: `Unknown movement type: ${movement.type}` }, { status: 400 });
    }

    const state = movement.stock_apply_state;
    const retryable = (state === 'pending' || state === 'failed') && typeof movement.stock_before === 'number';
    let baseStock = stockNow;
    let productAlreadyWritten = false;
    // ¿el estado quedó realmente persistido? Si el esquema de Movement aún no tiene
    // los campos nuevos, la plataforma los descarta en silencio: sin estado NO hay
    // recuperación segura y los llamadores no deben reintentar a ciegas.
    let recoverable = retryable;

    if (retryable) {
      // Recuperación: ¿el producto ya refleja este movimiento?
      const before = movement.stock_before as number;
      const expected = compute(before);
      const unwritten = stockNow === before;
      if (!unwritten && stockNow !== expected) {
        return Response.json({
          success: false, needs_review: true, product_written: null,
          error: `needs_review: stock actual ${stockNow} no coincide con stock_before ${before} ni con el esperado ${expected}`,
        }, { status: 409 });
      }
      // Coincidir en valor no prueba nada (ABA): solo se recupera si nadie más tocó el producto.
      const blocker = await recoveryBlocker(base44, movement, product, !unwritten);
      if (blocker) {
        return Response.json({
          success: false, needs_review: true, product_written: null,
          error: `needs_review: no se puede probar que el stock siga intacto (${blocker}); no se corrige automáticamente`,
        }, { status: 409 });
      }
      if (unwritten) baseStock = before; // la escritura del producto no ocurrió: aplicar
      else productAlreadyWritten = true; // ya escrito y nadie más lo tocó: solo falta la marca
    } else if (state === 'pending' || state === 'failed') {
      return Response.json({ success: false, needs_review: true, product_written: null, error: 'needs_review: movimiento pendiente sin stock_before' }, { status: 409 });
    } else {
      const age = Date.now() - Date.parse(movement.created_date || '');
      if (Number.isFinite(age) && age > LEGACY_WINDOW_MS) {
        return Response.json({
          success: false, needs_review: true, product_written: null,
          error: 'needs_review: movimiento histórico sin stock_apply_state; no se reaplica automáticamente',
        }, { status: 409 });
      }
    }

    let newStock = productAlreadyWritten ? stockNow : compute(baseStock);

    // (a) rastro ANTES de tocar el producto
    if (!retryable) {
      try {
        await withRetry(() => base44.asServiceRole.entities.Movement.update(movement_id, {
          stock_apply_state: 'pending',
          stock_before: stockNow,
          stock_pending_at: new Date().toISOString(),
        }));
      } catch (e) {
        // Nada se escribió todavía: seguro devolver error.
        return Response.json({ success: false, product_written: false, recoverable: false, error: `pending-mark failed: ${(e as Error).message}` }, { status: 500 });
      }
      try {
        const chk = await withRetry(() => base44.asServiceRole.entities.Movement.get(movement_id));
        recoverable = chk?.stock_apply_state === 'pending' && chk?.stock_before === stockNow;
      } catch { recoverable = false; }
      if (!recoverable) {
        console.log(`[applyMovementStock] WARNING: stock_apply_state no se persistió para ${movement_id} (¿esquema Movement sin desplegar?). Modo degradado: sin recuperación automática.`);
      }
    }

    // (a2) Anti lost-update: Product.update escribe un valor ABSOLUTO. Entre la lectura
    // inicial y la escritura hubo round-trips (marca pending, relectura), así que otro
    // movimiento del mismo producto pudo haber cambiado el stock. Se relee JUSTO antes de
    // escribir y se recalcula sobre el valor fresco; nunca se sobrescribe a ciegas.
    let beforeStock = retryable ? (movement.stock_before as number) : stockNow;
    const readFresh = async () => ((await withRetry(() => base44.asServiceRole.entities.Product.get(movement.product_id)))?.stock || 0) as number;
    if (!productAlreadyWritten) {
      let settled = false;
      for (let i = 0; i < 3 && !settled; i++) {
        let fresh: number;
        try {
          fresh = await readFresh();
        } catch (e) {
          return Response.json({ success: false, product_written: false, recoverable, error: `Product re-read failed: ${(e as Error).message}` }, { status: 500 });
        }
        if (fresh === baseStock) { settled = true; break; }
        if (retryable) {
          // Recuperación: el stock se movió desde que se decidió. No se infiere por valor (ABA): revisión humana.
          return Response.json({
            success: false, needs_review: true, product_written: null,
            error: `needs_review: el stock cambió a ${fresh} durante la recuperación (stock_before ${beforeStock}); no se corrige automáticamente`,
          }, { status: 409 });
        }
        // Movimiento nuevo y producto sin escribir: otro movimiento concurrente cambió el stock.
        // Rebasar: actualizar stock_before al valor fresco y recalcular.
        console.log(`[applyMovementStock] stock concurrente en ${movement.product_id}: ${baseStock} -> ${fresh}; se recalcula`);
        try {
          await withRetry(() => base44.asServiceRole.entities.Movement.update(movement_id, { stock_apply_state: 'pending', stock_before: fresh, stock_pending_at: new Date().toISOString() }));
        } catch (e) {
          return Response.json({ success: false, product_written: false, recoverable: false, error: `pending-mark failed: ${(e as Error).message}` }, { status: 500 });
        }
        baseStock = fresh;
        beforeStock = fresh;
      }
      if (!settled) {
        // Contención persistente: no se escribió nada; el llamador puede reintentar.
        return Response.json({ success: false, product_written: false, recoverable, error: 'stock del producto cambiando por movimientos concurrentes; reintenta' }, { status: 503 });
      }
      if (!productAlreadyWritten) newStock = compute(baseStock);
    }

    // (b) escribir el producto. Cada reintento tras un error transitorio relee primero:
    // un timeout pudo haber escrito, o un tercero pudo haber cambiado el stock.
    if (!productAlreadyWritten) {
      let lastErr: unknown = null;
      for (let i = 0; i < 3; i++) {
        if (i > 0) {
          await new Promise((r) => setTimeout(r, Deno.env.get('STOCK_APPLY_RETRY_MS') === '0' ? 0 : [300, 1000][i - 1]));
          let cur: number;
          try {
            cur = await readFresh();
          } catch (e) {
            return Response.json({ success: false, product_written: null, recoverable, error: `Product re-read failed: ${(e as Error).message}` }, { status: 500 });
          }
          if (cur === newStock) { lastErr = null; break; } // la escritura anterior sí ocurrió
          if (cur !== beforeStock) {
            return Response.json({
              success: false, needs_review: true, product_written: null,
              error: `needs_review: el stock cambió a ${cur} (stock_before ${beforeStock}, esperado ${newStock}) tras un error de escritura`,
            }, { status: 409 });
          }
        }
        try {
          await base44.asServiceRole.entities.Product.update(movement.product_id, { stock: newStock });
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (!isTransient(e)) break;
        }
      }
      if (lastErr) {
        // Un timeout puede haber escrito igualmente: el reintento lo resuelve con stock_before.
        return Response.json({ success: false, product_written: null, recoverable, error: `Product.update failed: ${(lastErr as Error).message}` }, { status: isTransient(lastErr) ? 500 : 400 });
      }
    }

    // (c) marca final
    try {
      await withRetry(() => base44.asServiceRole.entities.Movement.update(movement_id, {
        stock_applied: true,
        stock_apply_state: 'applied',
        stock_after: newStock,
        stock_apply_error: '',
      }));
    } catch (e) {
      return Response.json({ success: false, product_written: true, recoverable, error: `Movement mark failed: ${(e as Error).message}` }, { status: 500 });
    }

    return Response.json({ success: true, product_id: movement.product_id, new_stock: newStock, recovered: productAlreadyWritten || undefined });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
