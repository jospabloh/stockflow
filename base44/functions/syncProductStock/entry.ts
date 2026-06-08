import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * syncProductStock — automatización de Base44 sobre eventos de Movement.
 *
 * Ya NO es la autoridad del stock. Para eventos `create` delega en
 * `applyMovementStock`, que aplica el efecto EXACTAMENTE UNA VEZ (idempotente
 * vía Movement.stock_applied). Así, si el escritor ya aplicó el efecto de forma
 * síncrona, esta automatización no lo duplica.
 *
 * Para `update`/`delete` mantiene el ajuste relativo (los borrados se manejan
 * además explícitamente en deleteMovementSafe).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    // ── Auth: CRON_SECRET (scheduler/evento interno) o usuario del tenant ──
    const cronSecretEnv = Deno.env.get('CRON_SECRET');
    const validCron = cronSecretEnv && (
      req.headers.get('x-cron-secret') === cronSecretEnv ||
      body?.['x-cron-secret'] === cronSecretEnv
    );

    let user = null;
    if (!validCron) {
      user = await base44.auth.me().catch(() => null);
      if (!user) {
        console.log('[SYNC-STOCK] Unauthorized request rejected');
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (!data || !data.product_id) {
      console.log('[SYNC-STOCK] No product_id, skipping');
      return Response.json({ skipped: true });
    }

    const isServiceRole = Boolean(validCron) || !user?.business_id;
    if (!isServiceRole && data.business_id && data.business_id !== user.business_id) {
      console.log(`[SYNC-STOCK] Forbidden: movement business ${data.business_id} != user business ${user.business_id}`);
      return Response.json({ error: 'Forbidden: business_id mismatch' }, { status: 403 });
    }

    // ── CREATE: delegar en la autoridad idempotente ───────────────────────
    // applyMovementStock respeta stock_applied, por lo que NO duplica el efecto
    // si el escritor ya lo aplicó de forma síncrona.
    if (event?.type === 'create') {
      const res = await base44.asServiceRole.functions.invoke('applyMovementStock', {
        movement_id: data.id,
        business_id: data.business_id,
      });
      console.log(`[SYNC-STOCK] create delegated to applyMovementStock for movement ${data.id}`);
      return Response.json({ success: true, delegated: true, result: res?.data ?? null });
    }

    // ── UPDATE / DELETE: ajuste relativo (compatibilidad) ─────────────────
    const product = await base44.asServiceRole.entities.Product.get(data.product_id);
    if (!product) {
      console.log(`[SYNC-STOCK] Product ${data.product_id} not found`);
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }

    if (data.business_id && product.business_id && product.business_id !== data.business_id) {
      console.log(`[SYNC-STOCK] Forbidden: product business ${product.business_id} != movement business ${data.business_id}`);
      return Response.json({ error: 'Forbidden: product/movement tenant mismatch' }, { status: 403 });
    }

    let newStock = product.stock || 0;

    if (event?.type === 'update') {
      if (old_data && old_data.quantity !== data.quantity) {
        const qtyDiff = data.quantity - old_data.quantity;
        if (old_data.type === 'entry') {
          newStock += qtyDiff;
        } else if (old_data.type === 'exit' || old_data.type === 'return') {
          newStock -= qtyDiff;
        } else if (old_data.type === 'adjustment') {
          newStock += qtyDiff;
        }
        console.log(`[SYNC-STOCK] UPDATE: quantity ${old_data.quantity} → ${data.quantity}, new stock: ${newStock}`);
      }
    } else if (event?.type === 'delete') {
      if (data.type === 'entry') {
        newStock -= data.quantity;
      } else if (data.type === 'exit' || data.type === 'return') {
        newStock += data.quantity;
      } else if (data.type === 'adjustment') {
        newStock -= data.quantity;
      }
      console.log(`[SYNC-STOCK] DELETE: reversing ${data.type}, new stock: ${newStock}`);
    }

    if (newStock < 0) {
      console.log(`[SYNC-STOCK] WARNING: Stock went negative (${newStock}), capping at 0`);
      newStock = 0;
    }

    await base44.asServiceRole.entities.Product.update(data.product_id, { stock: newStock });
    console.log(`[SYNC-STOCK] ✅ Product ${data.product_id} stock updated to ${newStock}`);

    return Response.json({ success: true, new_stock: newStock });
  } catch (error) {
    console.log(`[SYNC-STOCK] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
