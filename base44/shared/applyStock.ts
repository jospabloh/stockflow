/**
 * applyStock — utilidades compartidas para aplicar el efecto de un Movement
 * sobre Product.stock sin tragarse los errores.
 *
 * Contexto (incidente Baristop, sep-2026): applyMovementStock hace dos
 * escrituras (Product.update y luego Movement.update{stock_applied}). Los
 * escritores (createMovementSafe, convert, deliver, cancel, partialReturn) lo
 * invocaban dentro de un try/catch que solo hacía console.log, así que si la
 * 2a escritura fallaba el usuario veía "éxito" y el movimiento quedaba con
 * stock_applied=false para siempre, sin aviso.
 *
 * - withRetry: reintenta ante 429 / 5xx / error de red / timeout.
 * - applyStockForMovement: invoca applyMovementStock con reintento (es seguro:
 *   la función es idempotente y se recupera con stock_before), y si al final
 *   falla deja el Movement en stock_apply_state='failed' y escribe una alerta
 *   persistente (InventoryAuditLog, event_type='stock_apply_failed').
 *   NUNCA lanza: devuelve { ok:false, ... } para que el llamador avise al
 *   usuario sin dejar a medias una operación multi-item.
 */

// deno-lint-ignore no-explicit-any
type Any = any;

export const RETRY_DELAYS_MS = [300, 1000, 3000];

function delays(): number[] {
  // STOCK_APPLY_RETRY_MS=0 (solo pruebas) elimina las esperas.
  return Deno.env.get('STOCK_APPLY_RETRY_MS') === '0' ? [0, 0, 0] : RETRY_DELAYS_MS;
}

export function errStatus(e: Any): number | undefined {
  const s = e?.response?.status ?? e?.status ?? e?.statusCode;
  return typeof s === 'number' ? s : undefined;
}

/** Transitorio = sin status (red/timeout), 408, 425, 429 o 5xx. */
export function isTransient(e: Any): boolean {
  const s = errStatus(e);
  if (s === undefined) return true;
  return s === 408 || s === 425 || s === 429 || s >= 500;
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  const d = delays();
  let last: Any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isTransient(e) || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, d[Math.min(i, d.length - 1)]));
    }
  }
  throw last;
}

export type ApplyStockResult = {
  ok: boolean;
  error?: string;
  product_written?: boolean | null;
  needs_review?: boolean;
  alerted?: boolean;
};

function errMessage(e: Any): string {
  const data = e?.response?.data ?? e?.data;
  return String(data?.error || data?.message || e?.message || e).slice(0, 500);
}

export async function applyStockForMovement(
  base44: Any,
  p: { movement_id: string; business_id?: string; product_id?: string; product_name?: string; caller: string },
): Promise<ApplyStockResult> {
  let lastErr: Any = null;
  let data: Any = null;
  for (let i = 0; i < 2; i++) {
    try {
      const resp = await base44.asServiceRole.functions.invoke('movements', {
        action: 'applyMovementStock',
        movement_id: p.movement_id,
        business_id: p.business_id,
        'x-cron-secret': Deno.env.get('CRON_SECRET'),
      });
      data = resp?.data ?? resp;
      // Un 200 con success:false también cuenta como fallo.
      if (data && data.success === false) {
        lastErr = Object.assign(new Error(data.error || 'applyMovementStock success=false'), { response: { status: 500, data } });
      } else {
        return { ok: true };
      }
    } catch (e) {
      lastErr = e;
    }
    // Solo se reintenta si es seguro: 409 needs_review / 4xx definitivos no; y si el
    // producto pudo haberse escrito (product_written true/null) solo cuando el estado
    // quedó persistido (recoverable), porque entonces applyMovementStock decide con
    // stock_before y no puede aplicar dos veces.
    const rd = lastErr?.response?.data ?? lastErr?.data ?? {};
    const safeToRetry = rd.product_written === false || rd.recoverable === true;
    if (!isTransient(lastErr) || !safeToRetry) break;
    await new Promise((r) => setTimeout(r, delays()[0]));
  }

  const rdata = lastErr?.response?.data ?? lastErr?.data ?? {};
  const message = errMessage(lastErr);
  const result: ApplyStockResult = {
    ok: false,
    error: message,
    product_written: rdata.product_written ?? null,
    needs_review: rdata.needs_review === true || errStatus(lastErr) === 409,
  };
  console.log(`[${p.caller}] applyMovementStock FAILED for ${p.movement_id}: ${message}`);

  // Dejar rastro persistente. Todo best-effort: nunca lanzar desde aquí.
  try {
    const mov = await base44.asServiceRole.entities.Movement.get(p.movement_id);
    if (mov?.stock_applied === true) return { ok: true }; // se aplicó pese al error de respuesta
    try {
      await base44.asServiceRole.entities.Movement.update(p.movement_id, {
        stock_apply_state: 'failed',
        stock_apply_error: message,
      });
    } catch (e) {
      console.log(`[${p.caller}] could not mark movement ${p.movement_id} failed: ${errMessage(e)}`);
    }
    await base44.asServiceRole.entities.InventoryAuditLog.create({
      business_id: p.business_id || mov?.business_id,
      product_id: p.product_id || mov?.product_id || 'unknown',
      product_name: p.product_name || mov?.product_name,
      event_type: 'stock_apply_failed',
      notes: `[${p.caller}] No se pudo aplicar el stock del movimiento ${p.movement_id}` +
        ` (${result.needs_review ? 'requiere revisión' : 'fallo transitorio'}; producto escrito: ` +
        `${result.product_written === true ? 'sí' : result.product_written === false ? 'no' : 'desconocido'}). ` +
        `Error: ${message}`,
      stock_before: typeof mov?.stock_before === 'number' ? mov.stock_before : undefined,
    });
    result.alerted = true;
  } catch (e) {
    console.log(`[${p.caller}] could not persist alert for ${p.movement_id}: ${errMessage(e)}`);
  }
  return result;
}

/** Forma común del aviso que se devuelve al frontend. */
export function stockWarning(failures: Array<{ movement_id: string; product_name?: string; error?: string }>) {
  return failures.length === 0 ? undefined : {
    message: 'El movimiento se registró pero el stock NO se pudo actualizar de forma confirmada. ' +
      'Se dejó una alerta; revisa el inventario del producto antes de repetir la operación.',
    failures,
  };
}
