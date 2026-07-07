import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
 * Autorización: igual que el resto de funciones internas — acepta CRON_SECRET
 * (scheduler / invocación service-role) o un usuario autenticado de su propio
 * tenant.
 */
Deno.serve(async (req) => {
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
    let newStock = product.stock || 0;

    if (movement.type === 'entry') {
      newStock += qty;
    } else if (movement.type === 'exit' || movement.type === 'return') {
      newStock -= qty;
    } else if (movement.type === 'adjustment') {
      newStock = qty; // adjustment fija el stock final de forma absoluta
    } else {
      return Response.json({ success: false, error: `Unknown movement type: ${movement.type}` }, { status: 400 });
    }

    if (newStock < 0) newStock = 0;

    await base44.asServiceRole.entities.Product.update(movement.product_id, { stock: newStock });
    await base44.asServiceRole.entities.Movement.update(movement_id, {
      stock_applied: true,
      stock_after: newStock,
    });

    return Response.json({ success: true, product_id: movement.product_id, new_stock: newStock });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
});
