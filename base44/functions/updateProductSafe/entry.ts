import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// SECURITY: Explicit whitelist of updatable Product fields
const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'sku',
  'barcode',
  'description',
  'category',
  'supplier',
  'purchase_price',
  'retail_sale_price',
  'wholesale_sale_price',
  'wholesale_min_qty',
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

    // CRITICAL: Validate business_id ownership (cross-tenant protection)
    if (product.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SECURITY: Filter updates through whitelist (mass assignment protection)
    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    // Validate numeric constraints on sanitized data
    if (sanitized.retail_sale_price != null && sanitized.retail_sale_price < 0) {
      return Response.json({ success: false, error: 'El precio menudeo no puede ser negativo' }, { status: 400 });
    }
    if (sanitized.wholesale_sale_price != null && sanitized.wholesale_sale_price < 0) {
      return Response.json({ success: false, error: 'El precio mayoreo no puede ser negativo' }, { status: 400 });
    }
    if (sanitized.purchase_price != null && sanitized.purchase_price < 0) {
      return Response.json({ success: false, error: 'El precio de compra no puede ser negativo' }, { status: 400 });
    }
    if (sanitized.wholesale_min_qty != null && sanitized.wholesale_min_qty < 0) {
      return Response.json({ success: false, error: 'La cantidad mínima para mayoreo no puede ser negativa' }, { status: 400 });
    }

    if (Object.keys(sanitized).length === 0) {
      return Response.json({ success: true, product_id, product, message: 'No valid fields to update' });
    }

    const updated = await base44.entities.Product.update(product_id, sanitized);

    return Response.json({ success: true, product_id, product: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});