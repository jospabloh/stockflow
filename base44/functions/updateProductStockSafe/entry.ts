import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { product_id, new_stock, business_id } = body;

    if (!product_id) {
      return Response.json({ error: 'product_id is required' }, { status: 400 });
    }

    if (typeof new_stock !== 'number' || new_stock < 0) {
      return Response.json({ error: 'new_stock must be a non-negative number' }, { status: 400 });
    }

    // Fetch product to validate ownership
    const products = await base44.entities.Product.filter({ id: product_id });
    if (products.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const product = products[0];

    // CRITICAL: Validate business_id ownership
    if (product.business_id !== business_id || product.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update ONLY stock field with whitelist protection
    await base44.asServiceRole.entities.Product.update(product.id, {
      stock: new_stock
    });

    return Response.json({
      success: true,
      product_id,
      new_stock
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});