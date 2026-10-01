import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { category_id } = body;

    if (!category_id) {
      return Response.json({ error: 'category_id is required' }, { status: 400 });
    }

    // Fetch record to validate ownership
    const records = await base44.entities.Category.filter({ id: category_id });
    if (records.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const record = records[0];

    // CRITICAL: Validate business_id ownership
    if (record.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check for products using this category (scoped to business)
    const products = await base44.entities.Product.filter({ category: category_id, business_id: user.business_id });
    if (products.length > 0) {
      return Response.json({
        error: `No se puede eliminar: ${products.length} producto(s) usan esta categoría.`,
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

    await base44.asServiceRole.entities.Category.delete(category_id);

    return Response.json({ success: true, category_id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}