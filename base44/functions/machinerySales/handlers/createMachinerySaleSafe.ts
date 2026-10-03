import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { applyCost, normalizeFields, validate } from './_fields.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Alta de una venta de maquinaria. Gateada por 'Venta de Maquinaria:create';
 * el costo sólo se toma del cuerpo si además tiene ':financials'.
 *
 * Este registro es deliberadamente independiente: no toca inventario, ni caja
 * chica, ni cotizaciones. La petición original ("no sería agregar productos,
 * sería q nos ponga los campos y nosotros llenarlo") es un libro aparte, y
 * engancharlo a caja chica duplicaría importes que ya entran por el flujo de
 * cotizaciones.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { business_id } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }
    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` }, { status: 403 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Venta de Maquinaria', 'create');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Venta de Maquinaria:create' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const canSeeFinancials = await hasPermission(base44.asServiceRole, user, 'Venta de Maquinaria', 'financials');
    const fields = normalizeFields(body);
    const cost = applyCost(body, canSeeFinancials, 0);

    const invalid = validate(fields, cost);
    if (invalid) {
      return Response.json({ success: false, error: invalid }, { status: 400 });
    }

    const created = await base44.asServiceRole.entities.MachinerySale.create({
      business_id,
      ...fields,
      cost,
    });

    return Response.json({ success: true, sale_id: created.id, sale: created });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
