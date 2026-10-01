import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { hasPermission } from './_permissions.ts';

/**
 * Safe Supplier creation with business_id validation
 * Rejects if:
 * 1. business_id is missing
 * 2. business_id doesn't match user's business_id
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, business_id, contact_name, email, phone, address, rfc, notes, extra_contacts } = body;

    // VALIDATION: business_id required
    if (!business_id) {
      return Response.json({ 
        success: false, 
        error: 'business_id is required' 
      }, { status: 400 });
    }

    // VALIDATION: business_id must match user's business
    if (business_id !== user.business_id) {
      return Response.json({ 
        success: false, 
        error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` 
      }, { status: 403 });
    }

    // VALIDATION: name required (400, same as createClientSafe/createContactSafe)
    if (typeof name !== 'string' || !name.trim()) {
      return Response.json({ success: false, error: 'El nombre del proveedor es requerido' }, { status: 400 });
    }

    // PERMISSION CHECK — RLS/role only isolate tenants; the granular key is enforced here.
    if (!(await hasPermission(base44.asServiceRole, user, 'Proveedores', 'create'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Proveedores:create' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // All validations passed, create the supplier
    const supplier = await base44.entities.Supplier.create({
      name,
      business_id,
      contact_name,
      email,
      phone,
      address,
      rfc,
      notes,
      extra_contacts: extra_contacts || "[]",
    });

    return Response.json({ 
      success: true, 
      supplier_id: supplier.id,
      supplier
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}