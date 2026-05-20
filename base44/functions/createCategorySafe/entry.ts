import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Safe Category creation with business_id validation.
 * wholesale_min_qty is now stored in Category (source of truth for wholesale threshold).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, business_id, description, color, wholesale_min_qty } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }

    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Unauthorized: business_id mismatch' }, { status: 403 });
    }

    if (wholesale_min_qty != null && Number(wholesale_min_qty) < 0) {
      return Response.json({ success: false, error: 'La cantidad mínima mayoreo no puede ser negativa' }, { status: 400 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
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
});