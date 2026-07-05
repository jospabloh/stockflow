import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

// SECURITY: Explicit whitelist of updatable Course fields (mass assignment protection)
const ALLOWED_UPDATE_FIELDS = new Set([
  'title',
  'description',
  'topics',
  'includes',
  'location',
  'price_options',
  'extra_person_price',
  'cost',
  'capacity',
  'instructor_name',
  'instructor_note',
  'sessions',
  'flyer_url',
  'status',
  'notes'
]);

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { course_id, updates } = body;

    if (!course_id || !updates) {
      return Response.json({ success: false, error: 'course_id and updates are required' }, { status: 400 });
    }

    // Fetch course to validate ownership — use asServiceRole to avoid RLS blocking
    const courses = await base44.asServiceRole.entities.Course.filter({ id: course_id });
    if (courses.length === 0) {
      return Response.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const course = courses[0];

    // CRITICAL: Validate business_id ownership (cross-tenant protection)
    if (course.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // SECURITY: Filter updates through whitelist
    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return Response.json({ success: true, course_id, course, message: 'No valid fields to update' });
    }

    // VALIDATION: Required field cannot be blanked out
    const newTitle = 'title' in sanitized ? sanitized.title : course.title;
    if (!newTitle?.trim()) {
      return Response.json({ success: false, error: 'El nombre del curso es requerido' }, { status: 400 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz2 = bizArr[0];
    const billingStatus2 = biz2?.billing_status || 'active';
    if (billingStatus2 === 'view_only' || billingStatus2 === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus2 }, { status: 403 });
    }

    // Use asServiceRole for the update — ownership already validated above
    const updated = await base44.asServiceRole.entities.Course.update(course_id, sanitized);

    return Response.json({ success: true, course_id, course: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
