import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * syncProductStock — automatización de Base44 sobre eventos de Movement.
 *
 * Ya NO es la autoridad del stock en `create`. TODOS los caminos que crean
 * movimientos de inventario aplican el efecto ellos mismos, de una de dos formas:
 *   1) invocando applyMovementStock de forma síncrona (createMovementSafe,
 *      convertQuotationSafe, partialReturnQuotation, cancelQuotationSafe,
 *      deliverQuotationSafe), o
 *   2) creando el movimiento con stock_applied=true porque ya fijaron el stock
 *      directamente (importItemsSafe, applyInventoryAuditCorrection, y en el
 *      frontend ProductFormDialog y CreateFromOnDemandModal).
 *
 * Por eso el evento `create` aquí es un NO-OP a propósito: tener un segundo
 * aplicador (la automatización) compitiendo con el escritor síncrono provoca una
 * CARRERA que puede aplicar el delta dos veces (ambos leen stock_applied=false
 * antes de que cualquiera lo marque). Con un único aplicador por movimiento, la
 * carrera es imposible. Cualquier movimiento que quedara sin aplicar (camino
 * futuro no contemplado) lo detecta dailyStockReconcile (stock_applied=false).
 *
 * Para `update`/`delete` mantiene el ajuste relativo (los borrados se manejan
 * además explícitamente en deleteMovementSafe).
 *
 * NOTA AUTH: Esta función es invocada por una automatización de entidad (sin
 * usuario real). No se valida business_id contra un usuario autenticado;
 * todas las operaciones usan asServiceRole para evitar el mismatch de tenants.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    if (!data || !data.product_id) {
      console.log('[SYNC-STOCK] No product_id, skipping');
      return Response.json({ skipped: true });
    }

    // ── CREATE: NO-OP (ver cabecera) ──────────────────────────────────────
    if (event?.type === 'create') {
      console.log(`[SYNC-STOCK] create no-op (stock aplicado por el escritor) movement ${data.id}`);
      return Response.json({ success: true, noop: true });
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