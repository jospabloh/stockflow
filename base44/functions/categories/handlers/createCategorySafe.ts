import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { hasPermission } from './_permissions.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Safe Category creation with business_id validation.
 * wholesale_min_qty is now stored in Category (source of truth for wholesale threshold).
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { business_id, description, color, wholesale_min_qty } = body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }

    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Unauthorized: business_id mismatch' }, { status: 403 });
    }

    if (!name) {
      return Response.json({ success: false, error: 'El nombre de la categoría es obligatorio' }, { status: 400 });
    }

    if (wholesale_min_qty != null && Number(wholesale_min_qty) < 0) {
      return Response.json({ success: false, error: 'La cantidad mínima mayoreo no puede ser negativa' }, { status: 400 });
    }

    // PERMISSION CHECK — RLS/role only isolate tenants; the granular key is enforced here.
    if (!(await hasPermission(base44.asServiceRole, user, 'Categorias', 'create'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Categorias:create' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // DUPLICATE CHECK — names are unique per tenant (case-insensitive, trimmed).
    const existing = await base44.asServiceRole.entities.Category.filter({ business_id }, undefined, 5000);
    const key = name.toLocaleLowerCase();
    if ((existing || []).some((c: { name?: string }) => String(c.name ?? '').trim().toLocaleLowerCase() === key)) {
      return Response.json({ success: false, error: 'Ya existe una categoría con ese nombre', code: 'duplicate_name' }, { status: 409 });
    }

    const category = await base44.entities.Category.create({
      name,
      business_id,
      description,
      color,
      ...(wholesale_min_qty != null ? { wholesale_min_qty: Number(wholesale_min_qty) } : {}),
    });

    return Response.json({ success: true, category_id: category.id, category });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}