import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { product_id } = body;

    if (!product_id) {
      return Response.json({ error: 'product_id is required' }, { status: 400 });
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
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Delete product
    await base44.entities.Product.delete(product_id);

    return Response.json({
      success: true,
      product_id,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});