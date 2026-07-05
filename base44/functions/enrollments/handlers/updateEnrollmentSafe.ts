import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

// SECURITY: Explicit whitelist. course_id/contact_id (and their snapshots) are
// set at creation and intentionally immutable here.
const ALLOWED_UPDATE_FIELDS = new Set([
  'status',
  'price_option_label',
  'price_amount',
  'people_count',
  'amount_paid',
  'payment_method',
  'deposit_amount',
  'invoice_status',
  'reason',
  'reason_other',
  'age',
  'notes',
  'confirmation_sent_at',
  'reminder_sent_at'
]);

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { enrollment_id, updates } = body;

    if (!enrollment_id || !updates) {
      return Response.json({ success: false, error: 'enrollment_id and updates are required' }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.Enrollment.filter({ id: enrollment_id });
    if (rows.length === 0) {
      return Response.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
    }
    const enrollment = rows[0];

    if (enrollment.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return Response.json({ success: true, enrollment_id, enrollment, message: 'No valid fields to update' });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz2 = bizArr[0];
    const billingStatus2 = biz2?.billing_status || 'active';
    if (billingStatus2 === 'view_only' || billingStatus2 === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus2 }, { status: 403 });
    }

    const updated = await base44.asServiceRole.entities.Enrollment.update(enrollment_id, sanitized);

    return Response.json({ success: true, enrollment_id, enrollment: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
