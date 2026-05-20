import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admins and almacenistas can update stock
    if (user.role !== 'admin' && user.role !== 'almacenista') {
      return Response.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    }

    if (!user.business_id) {
      return Response.json({ error: 'User has no business assigned' }, { status: 403 });
    }

    const body = await req.json();
    const { product_id, new_stock, business_id } = body;

    if (!product_id) {
      return Response.json({ error: 'product_id is required' }, { status: 400 });
    }

    if (typeof new_stock !== 'number' || new_stock < 0) {
      return Response.json({ error: 'new_stock must be a non-negative number' }, { status: 400 });
    }

    // CRITICAL: Validate that caller's business_id matches user's business_id
    if (business_id && business_id !== user.business_id) {
      console.error(
        `[updateProductStockSafe] business_id mismatch: user ${user.email} (${user.business_id}) sent (${business_id})`
      );
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role to fetch product so RLS doesn't silently block valid products
    let products;
    try {
      products = await base44.asServiceRole.entities.Product.filter({ id: product_id });
    } catch (_e) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }
    if (!products || products.length === 0) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = products[0];

    // CRITICAL: Validate business_id ownership — prevent cross-tenant stock update
    if (product.business_id !== user.business_id) {
      console.error(
        `[updateProductStockSafe] CROSS-TENANT ATTEMPT: user ${user.email} (business ${user.business_id}) ` +
        `tried to update stock of product ${product_id} (business ${product.business_id})`
      );
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update ONLY stock field
    await base44.asServiceRole.entities.Product.update(product.id, {
      stock: new_stock,
    });

    return Response.json({
      success: true,
      product_id,
      new_stock,
    });
  } catch (error) {
    console.error('[updateProductStockSafe]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});