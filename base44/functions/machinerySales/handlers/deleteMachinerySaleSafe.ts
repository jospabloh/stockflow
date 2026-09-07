import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

/**
 * Baja de una venta de maquinaria. Gateada por 'Venta de Maquinaria:delete',
 * que el almacenista NO tiene por defecto (ver permissionRegistry.js).
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

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

    const allowed = await hasPermission(base44.asServiceRole, user, 'Venta de Maquinaria', 'delete');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Venta de Maquinaria:delete' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    await base44.asServiceRole.entities.MachinerySale.delete(sale_id);

    return Response.json({ success: true, sale_id });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
