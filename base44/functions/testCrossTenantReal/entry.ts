import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Real cross-tenant rejection test.
 * Finds an actual product that belongs to a DIFFERENT business than the calling user,
 * then attempts to update it via updateProductSafe and confirms rejection.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin required' }, { status: 403 });
    }

    const myBizId = user.business_id;
    const results = [];

    // Step 1: Find a product that belongs to a DIFFERENT business
    const allProducts = await base44.asServiceRole.entities.Product.list('-created_date', 500);
    const foreignProduct = allProducts.find(p => p.business_id !== myBizId);

    if (!foreignProduct) {
      return Response.json({
        summary: 'INCONCLUSIVE',
        reason: 'No products from other businesses found in the database. This is a single-tenant environment or all products belong to this business.',
        my_business_id: myBizId
      });
    }

    results.push({
      step: 'FOUND_FOREIGN_PRODUCT',
      product_id: foreignProduct.id,
      product_name: foreignProduct.name,
      foreign_business_id: foreignProduct.business_id,
      my_business_id: myBizId,
      note: 'These are different — genuine cross-tenant scenario'
    });

    // Step 2: Attempt to update the foreign product via updateProductSafe
    // This simulates an attacker who knows the product_id but is logged in as a different business
    let updateResult;
    try {
      // We call the function as the current user (myBizId) trying to touch foreignProduct.id
      // updateProductSafe MUST reject because foreignProduct.business_id !== myBizId
      const resp = await fetch(req.url.replace('/testCrossTenantReal', '/updateProductSafe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization') || '',
          'Cookie': req.headers.get('Cookie') || '',
        },
        body: JSON.stringify({
          product_id: foreignProduct.id,
          updates: { retail_sale_price: 0.01 }
        })
      });
      updateResult = await resp.json();
    } catch (e) {
      updateResult = { fetch_error: e.message };
    }

    const wasRejected = updateResult?.success === false || !!updateResult?.error || !!updateResult?.fetch_error;

    // Step 3: Verify foreign product was NOT modified
    const productAfter = await base44.asServiceRole.entities.Product.filter({ id: foreignProduct.id });
    const priceUnchanged = productAfter.length > 0 && productAfter[0].retail_sale_price !== 0.01;

    results.push({
      step: 'UPDATE_ATTEMPT_RESULT',
      response: updateResult,
      was_rejected: wasRejected,
      price_unchanged: priceUnchanged,
      price_after: productAfter[0]?.retail_sale_price ?? 'unknown'
    });

    const passed = wasRejected && priceUnchanged;

    return Response.json({
      summary: passed ? 'PASS — Cross-tenant update correctly rejected' : 'FAIL — Cross-tenant update was NOT rejected',
      status: passed ? 'PASS' : 'FAIL',
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});