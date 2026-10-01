import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { applyCost, normalizeFields, validate } from './_fields.ts';

/**
 * Edición de una venta de maquinaria. Gateada por 'Venta de Maquinaria:edit'.
 *
 * El inquilino se comprueba contra el registro ALMACENADO (módulo 14), no
 * contra el cuerpo: `business_id` ni siquiera se lee de la petición.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sale_id } = body;

    if (!sale_id) {
      return Response.json({ success: false, error: 'sale_id is required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.MachinerySale.filter({ id: sale_id });
    const record = records[0];
    if (!record) {
      return Response.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    if (record.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Venta de Maquinaria', 'edit');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Venta de Maquinaria:edit' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const canSeeFinancials = await hasPermission(base44.asServiceRole, user, 'Venta de Maquinaria', 'financials');
    const fields = normalizeFields(body);
    const cost = applyCost(body, canSeeFinancials, typeof record.cost === 'number' ? record.cost : 0);

    const invalid = validate(fields, cost);
    if (invalid) {
      return Response.json({ success: false, error: invalid }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.MachinerySale.update(sale_id, {
      ...fields,
      cost,
    });

    return Response.json({ success: true, sale_id, sale: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
