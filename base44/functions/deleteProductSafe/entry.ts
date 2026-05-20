import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can delete products
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    if (!user.business_id) {
      return Response.json({ error: 'User has no business assigned' }, { status: 403 });
    }

    const body = await req.json();
    const { product_id } = body;

    if (!product_id) {
      return Response.json({ error: 'product_id is required' }, { status: 400 });
    }

    // CRITICAL: Use service role to fetch product — bypasses RLS so we can validate ownership manually.
    // This fixes the bug where RLS would return 0 results for valid products causing silent 404.
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

    // CRITICAL: Validate business_id ownership — prevent cross-tenant delete
    if (product.business_id !== user.business_id) {
      console.error(
        `[deleteProductSafe] CROSS-TENANT ATTEMPT: user ${user.email} (business ${user.business_id}) ` +
        `tried to delete product ${product_id} (business ${product.business_id})`
      );
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // Check for associated movements — use service role for consistency
    const movements = await base44.asServiceRole.entities.Movement.filter({
      product_id,
      business_id: user.business_id,
    });

    if (movements.length > 0) {
      return Response.json({
        success: false,
        error: `No se puede eliminar: hay ${movements.length} movimiento(s) registrado(s) para este producto.`,
      }, { status: 400 });
    }

    // All checks passed — delete
    await base44.asServiceRole.entities.Product.delete(product_id);

    return Response.json({
      success: true,
      product_id,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('[deleteProductSafe]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});