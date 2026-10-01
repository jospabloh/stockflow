import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { confirmationEmail, reminderEmail } from './emailTemplates.ts';
import { hasPermission } from './_permissions.ts';

// Envía un correo de confirmación o recordatorio a UNA inscripción (botón manual).
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Sin sesión auth.me() lanza: tratarlo como no autenticado (401), no 500.
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { enrollment_id, kind } = body; // kind: 'confirmation' | 'reminder'
    if (!enrollment_id) {
      return Response.json({ success: false, error: 'enrollment_id is required' }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.Enrollment.filter({ id: enrollment_id });
    if (rows.length === 0) {
      return Response.json({ success: false, error: 'Enrollment not found' }, { status: 404 });
    }
    const enrollment = rows[0];
    if (enrollment.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const to = (enrollment.contact_email || '').trim();
    if (!to) {
      return Response.json({ success: false, error: 'El contacto no tiene correo registrado' }, { status: 400 });
    }

    // PERMISSION CHECK — RLS/role only isolate tenants; the granular key is enforced here.
    if (!(await hasPermission(base44.asServiceRole, user, 'Inscripciones', 'edit'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Inscripciones:edit' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }
    const businessName = biz?.name || '';

    const courseArr = await base44.asServiceRole.entities.Course.filter({ id: enrollment.course_id });
    const course = courseArr[0] || { title: enrollment.course_title };

    const tpl = kind === 'reminder'
      ? reminderEmail({ businessName, contactName: enrollment.contact_name, course })
      : confirmationEmail({ businessName, contactName: enrollment.contact_name, course });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to,
      subject: tpl.subject,
      body: tpl.html,
      from_name: businessName || 'Cursos',
    });

    const stampField = kind === 'reminder' ? 'reminder_sent_at' : 'confirmation_sent_at';
    await base44.asServiceRole.entities.Enrollment.update(enrollment_id, { [stampField]: new Date().toISOString() });

    return Response.json({ success: true, sent_to: to, kind: kind === 'reminder' ? 'reminder' : 'confirmation' });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
