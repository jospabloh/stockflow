import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    // ── Authentication & authorization ──────────────────────────────────────
    // This endpoint mutates product stock via the service role, so it must
    // never be invocable by an unauthenticated/anonymous HTTP caller. Accept:
    //   1. The internal event/scheduler system presenting a valid CRON_SECRET, or
    //   2. An authenticated user acting strictly within their own tenant.
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

    // Tenant isolation: a non-service-role user may only sync stock for
    // movements that belong to their own business.
    const isServiceRole = Boolean(validCron) || !user?.business_id;
    if (!isServiceRole && data.business_id && data.business_id !== user.business_id) {
      console.log(`[SYNC-STOCK] Forbidden: movement business ${data.business_id} != user business ${user.business_id}`);
      return Response.json({ error: 'Forbidden: business_id mismatch' }, { status: 403 });
    }

    console.log(`[SYNC-STOCK] Movement ${event.type}: ${data.product_id}, quantity: ${data.quantity}, type: ${data.type}`);

    // Fetch current product
    const product = await base44.asServiceRole.entities.Product.get(data.product_id);
    if (!product) {
      console.log(`[SYNC-STOCK] Product ${data.product_id} not found`);
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }

    // Defense in depth: the product must belong to the same tenant as the
    // movement, preventing cross-tenant stock manipulation.
    if (data.business_id && product.business_id && product.business_id !== data.business_id) {
      console.log(`[SYNC-STOCK] Forbidden: product business ${product.business_id} != movement business ${data.business_id}`);
      return Response.json({ error: 'Forbidden: product/movement tenant mismatch' }, { status: 403 });
    }

    let newStock = product.stock || 0;

    // Calculate new stock based on movement type
    if (event.type === 'create') {
      if (data.type === 'entry') {
        newStock += data.quantity;
        console.log(`[SYNC-STOCK] ENTRY: ${product.stock} + ${data.quantity} = ${newStock}`);
      } else if (data.type === 'exit' || data.type === 'return') {
        newStock -= data.quantity;
        console.log(`[SYNC-STOCK] ${data.type.toUpperCase()}: ${product.stock} - ${data.quantity} = ${newStock}`);
      } else if (data.type === 'adjustment') {
        // adjustment uses quantity as absolute change
        newStock += data.quantity; // can be positive or negative
        console.log(`[SYNC-STOCK] ADJUSTMENT: ${product.stock} + ${data.quantity} = ${newStock}`);
      }
    } else if (event.type === 'update') {
      // If movement is updated, recalculate based on old vs new
      if (old_data && old_data.quantity !== data.quantity) {
        const qtyDiff = data.quantity - old_data.quantity;
        if (old_data.type === 'entry') {
          newStock += qtyDiff;
        } else if (old_data.type === 'exit' || old_data.type === 'return') {
          newStock -= qtyDiff;
        } else if (old_data.type === 'adjustment') {
          newStock += qtyDiff;
        }
        console.log(`[SYNC-STOCK] UPDATE: quantity changed ${old_data.quantity} → ${data.quantity}, new stock: ${newStock}`);
      }
    } else if (event.type === 'delete') {
      // If movement is deleted, reverse the effect
      if (data.type === 'entry') {
        newStock -= data.quantity;
      } else if (data.type === 'exit' || data.type === 'return') {
        newStock += data.quantity;
      } else if (data.type === 'adjustment') {
        newStock -= data.quantity;
      }
      console.log(`[SYNC-STOCK] DELETE: reversing ${data.type}, new stock: ${newStock}`);
    }

    // Ensure stock doesn't go negative
    if (newStock < 0) {
      console.log(`[SYNC-STOCK] WARNING: Stock went negative (${newStock}), capping at 0`);
      newStock = 0;
    }

    // Update product stock
    await base44.asServiceRole.entities.Product.update(data.product_id, { stock: newStock });
    console.log(`[SYNC-STOCK] ✅ Product ${data.product_id} stock updated to ${newStock}`);

    return Response.json({ success: true, new_stock: newStock });
  } catch (error) {
    console.log(`[SYNC-STOCK] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});