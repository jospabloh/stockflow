import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// SECURITY: Explicit whitelist of updatable Product fields
// Blocks: id, business_id, created_by, created_date, updated_date, created_by_id, is_sample
const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'sku',
  'barcode',
  'description',
  'category',
  'supplier',
  'purchase_price',
  'sale_price',
  'stock',
  'min_stock',
  'unit',
  'tax_rate',
  'image_url',
  'status'
]);

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
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // SECURITY: Filter updates through whitelist (mass assignment protection)
    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        sanitized[key] = value;
      }
      // Silently ignore any non-whitelisted fields (including business_id injection attempts)
    }

    // If no valid fields to update, return success anyway (idempotent)
    if (Object.keys(sanitized).length === 0) {
      return Response.json({
        success: true,
        product_id,
        product: product,
        message: 'No valid fields to update'
      });
    }

    // Update product with sanitized data only
    const updated = await base44.entities.Product.update(product_id, sanitized);

    return Response.json({
      success: true,
      product_id,
      product: updated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});