import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { checkProductDuplicate, duplicateErrorMessage } from '../../../shared/productDuplicateCheck.ts';
import { validateProductStock } from '../../../shared/productStockValidation.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

// SECURITY: Explicit whitelist — wholesale_min_qty removed (now lives in Category)
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
  'stock',
  'min_stock',
  'unit',
  'tax_rate',
  'image_url',
  'status'
]);

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can edit product details (almacenista uses updateProductStockSafe for stock only)
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }

    if (!user.business_id) {
      return Response.json({ error: 'User has no business assigned' }, { status: 403 });
    }

    const body = await req.json();
    const { product_id, updates } = body;

    if (!product_id || !updates) {
      return Response.json({ error: 'product_id and updates are required' }, { status: 400 });
    }

    // Use service role to fetch product — prevents RLS from silently blocking valid requests
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

    // CRITICAL: Validate business_id ownership (cross-tenant protection)
    if (product.business_id !== user.business_id) {
      console.error(
        `[updateProductSafe] CROSS-TENANT ATTEMPT: user ${user.email} (business ${user.business_id}) ` +
        `tried to update product ${product_id} (business ${product.business_id})`
      );
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz2 = bizArr[0];
    const billingStatus = biz2?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
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

    const stockError = validateProductStock(sanitized.stock);
    if (stockError) {
      return Response.json({ success: false, error: stockError }, { status: 400 });
    }

    // DUPLICATE CHECK — only if name, sku, or barcode are being changed
    if (sanitized.name != null || sanitized.sku != null || sanitized.barcode != null) {
      const dup = await checkProductDuplicate(
        base44,
        user.business_id,
        sanitized.name ?? product.name,
        sanitized.sku ?? product.sku,
        sanitized.barcode ?? product.barcode,
        product_id
      );
      if (dup.duplicate) {
        return Response.json({ success: false, error: duplicateErrorMessage(dup) }, { status: 409 });
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return Response.json({ success: true, product_id, product, message: 'No valid fields to update' });
    }

    // Use asServiceRole for the update — ownership already validated above
    const updated = await base44.asServiceRole.entities.Product.update(product_id, sanitized);

    // Log direct stock edits to InventoryAuditLog for audit trail
    if (sanitized.stock !== undefined && sanitized.stock !== product.stock) {
      base44.asServiceRole.entities.InventoryAuditLog.create({
        product_id,
        product_name: product.name,
        business_id: user.business_id,
        event_type: 'direct_edit',
        stock_before: product.stock ?? 0,
        stock_after: sanitized.stock,
        notes: 'Stock editado directamente desde formulario de producto',
        performed_by: user.email,
      }).catch(() => {});
    }

    return Response.json({ success: true, product_id, product: updated });
  } catch (error) {
    console.error('[updateProductSafe]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}