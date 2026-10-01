import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { hasPermission } from './_permissions.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { supplier_id } = body;

    if (!supplier_id) {
      return Response.json({ error: 'supplier_id is required' }, { status: 400 });
    }

    // Fetch record to validate ownership
    const records = await base44.entities.Supplier.filter({ id: supplier_id });
    if (records.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const record = records[0];

    // CRITICAL: Validate business_id ownership
    if (record.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // PERMISSION CHECK — the granular registry key is enforced here, not just the role.
    if (!(await hasPermission(base44.asServiceRole, user, 'Proveedores', 'delete'))) {
      return Response.json({ error: 'Forbidden: missing permission', permission: 'Proveedores:delete' }, { status: 403 });
    }

    // Check for products using this supplier (scoped to business)
    const products = await base44.entities.Product.filter({ supplier: supplier_id, business_id: user.business_id });
    if (products.length > 0) {
      return Response.json({
        error: `No se puede eliminar: ${products.length} producto(s) tienen este proveedor asignado.`,
        blocked_by_products: products.length
      }, { status: 409 });
    }

    // LICENSE CHECK
    const bizArr2 = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz2 = bizArr2[0];
    const billingStatus2 = biz2?.billing_status || 'active';
    if (billingStatus2 === 'view_only' || billingStatus2 === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus2 }, { status: 403 });
    }

    await base44.asServiceRole.entities.Supplier.delete(supplier_id);

    return Response.json({ success: true, supplier_id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}