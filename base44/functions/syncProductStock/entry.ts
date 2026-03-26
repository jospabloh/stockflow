import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    if (!data || !data.product_id) {
      console.log('[SYNC-STOCK] No product_id, skipping');
      return Response.json({ skipped: true });
    }

    console.log(`[SYNC-STOCK] Movement ${event.type}: ${data.product_id}, quantity: ${data.quantity}, type: ${data.type}`);

    // Fetch current product
    const product = await base44.asServiceRole.entities.Product.get(data.product_id);
    if (!product) {
      console.log(`[SYNC-STOCK] Product ${data.product_id} not found`);
      return Response.json({ error: 'Product not found' }, { status: 404 });
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
    console.log(`[SYNC-STOCK] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});