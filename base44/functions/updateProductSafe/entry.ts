import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { product_id, updates } = body;

    if (!product_id || !updates) {
      return Response.json({ error: 'product_id and updates are required' }, { status: 400 });
    }

    // Fetch product to validate ownership
    const products = await base44.entities.Product.filter({ id: product_id });
    if (products.length === 0) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = products[0];

    // CRITICAL: Validate business_id ownership
    if (product.business_id !== user.business_id) {
      return Response.json(
        { error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${product.business_id})` },
        { status: 403 }
      );
    }

    // Update product
    const updated = await base44.entities.Product.update(product_id, updates);

    return Response.json({
      success: true,
      product_id,
      product: updated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});