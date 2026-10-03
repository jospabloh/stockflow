import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';
import { checkProductDuplicate, duplicateErrorMessage } from '../../../shared/productDuplicateCheck.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Safe write for Product.barcode — BarcodeGeneratorPage's handleSave() used
 * to call base44.entities.Product.update(product.id, { barcode }) directly,
 * with no permission or billing gate of any kind (not even client-side —
 * the /BarcodeGenerator route had no PermissionGate). Deliberately NOT
 * routed through updateProductSafe: that handler is hardcoded to
 * `user.role !== 'admin' → 403`, but 'Productos:edit_barcode' is granted to
 * almacenista by default (permissionRegistry.js), so reusing it would have
 * regressed the feature for every non-admin user instead of closing the
 * gap. This mirrors toggleUtilityForecastSafe's pattern: a narrow,
 * single-field Safe function gated by the specific permission key the
 * client already displays the control under.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { product_id, barcode } = body;

    if (!product_id || typeof barcode !== 'string' || !barcode.trim()) {
      return Response.json({ success: false, error: 'product_id and a non-empty barcode are required' }, { status: 400 });
    }

    // Load via service role — prevents RLS from silently blocking a valid
    // request, same reasoning updateProductSafe already uses.
    const products = await base44.asServiceRole.entities.Product.filter({ id: product_id });
    const product = products?.[0];
    if (!product) {
      return Response.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    if (product.business_id !== user.business_id) {
      console.error(
        `[updateProductBarcodeSafe] CROSS-TENANT ATTEMPT: user ${user.email} (business ${user.business_id}) ` +
        `tried to update product ${product_id} (business ${product.business_id})`
      );
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Productos', 'edit_barcode');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Productos:edit_barcode' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const billingStatus = businesses?.[0]?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // Same duplicate rule as createProductSafe / updateProductSafe, scoped to
    // the barcode only (name/sku passed empty so pre-existing name/SKU
    // duplicates never block a barcode edit). Excludes the product itself.
    const dup = await checkProductDuplicate(base44, user.business_id, '', '', barcode, product_id);
    if (dup.duplicate) {
      return Response.json({ success: false, error: duplicateErrorMessage(dup) }, { status: 409 });
    }

    const updated = await base44.asServiceRole.entities.Product.update(product_id, { barcode: barcode.trim() });

    return Response.json({ success: true, product_id, product: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
