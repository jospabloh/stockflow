import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title, business_id,
      description, topics, includes, location, price_options, extra_person_price, cost,
      capacity, instructor_name, instructor_note, sessions, flyer_url, status, notes
    } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }

    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Unauthorized: business_id mismatch' }, { status: 403 });
    }

    if (!title?.trim()) {
      return Response.json({ success: false, error: 'El nombre del curso es requerido' }, { status: 400 });
    }

    // PERMISSION CHECK — RLS/role only isolate tenants; the granular key is enforced here.
    if (!(await hasPermission(base44.asServiceRole, user, 'Cursos', 'create'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Cursos:create' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const course = await base44.entities.Course.create({
      title: title.trim(),
      business_id,
      description: description || "",
      topics: Array.isArray(topics) ? topics : [],
      includes: Array.isArray(includes) ? includes : [],
      location: location || "",
      price_options: Array.isArray(price_options) ? price_options : [],
      extra_person_price: typeof extra_person_price === 'number' ? extra_person_price : null,
      cost: typeof cost === 'number' ? cost : null,
      capacity: typeof capacity === 'number' ? capacity : null,
      instructor_name: instructor_name || "",
      instructor_note: instructor_note || "",
      sessions: Array.isArray(sessions) ? sessions : [],
      flyer_url: flyer_url || "",
      status: status || "draft",
      notes: notes || ""
    });

    return Response.json({ success: true, course_id: course.id, course });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
