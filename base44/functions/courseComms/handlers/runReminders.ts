import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { reminderEmail } from './emailTemplates.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

// Barre las inscripciones cuya próxima sesión es MAÑANA y aún no tienen recordatorio,
// y les envía el correo de recordatorio. Pensado para el cron (guardado por CRON_SECRET);
// el disparo manual es SOLO del dueño de la plataforma (PLATFORM_OWNER_EMAIL), nunca de un
// admin/owner de tenant (barre inscripciones de todos los tenants). Corre global (todos los tenants) vía asServiceRole.
const REMINDABLE = new Set(['confirmado', 'pagado']);

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Auth: CRON_SECRET (header o body) o dueño de la plataforma. Un role:admin de tenant
    // NO basta: el barrido envía correos a inscripciones de todos los tenants.
    const cronSecretEnv = Deno.env.get('CRON_SECRET');
    const validCron = cronSecretEnv && (
      req.headers.get('x-cron-secret') === cronSecretEnv ||
      body?.['x-cron-secret'] === cronSecretEnv
    );
    if (!validCron) {
      const user = await getAuthUser(base44);
      const platformOwnerEmail = Deno.env.get('PLATFORM_OWNER_EMAIL');
      if (!user || !platformOwnerEmail || user.email !== platformOwnerEmail) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Fecha de "mañana" (UTC).
    const now = new Date();
    const t = new Date(now.getTime() + 24 * 3600 * 1000);
    const tomorrow = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;

    const enrollments = await base44.asServiceRole.entities.Enrollment.filter({}, '-created_date', 2000);
    const courseCache: Record<string, any> = {};
    const bizNameCache: Record<string, string> = {};

    let sent = 0, failed = 0, matched = 0;
    for (const e of enrollments) {
      if (!REMINDABLE.has(e.status)) continue;
      if (e.reminder_sent_at) continue;
      const to = (e.contact_email || '').trim();
      if (!to) continue;

      let course = courseCache[e.course_id];
      if (course === undefined) {
        const arr = await base44.asServiceRole.entities.Course.filter({ id: e.course_id });
        course = arr[0] || null;
        courseCache[e.course_id] = course;
      }
      if (!course) continue;
      const hasTomorrow = (course.sessions || []).some((s: any) => s?.date === tomorrow);
      if (!hasTomorrow) continue;

      matched++;
      let businessName = bizNameCache[e.business_id];
      if (businessName === undefined) {
        const arr = await base44.asServiceRole.entities.Business.filter({ id: e.business_id });
        businessName = arr[0]?.name || '';
        bizNameCache[e.business_id] = businessName;
      }

      try {
        const tpl = reminderEmail({ businessName, contactName: e.contact_name, course });
        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: tpl.subject, body: tpl.html, from_name: businessName || 'Cursos' });
        await base44.asServiceRole.entities.Enrollment.update(e.id, { reminder_sent_at: new Date().toISOString() });
        sent++;
      } catch (err) {
        failed++;
        console.error(`[runReminders] Failed reminder to ${to}:`, (err as Error)?.message);
      }
    }

    console.log(`[runReminders] tomorrow=${tomorrow} matched=${matched} sent=${sent} failed=${failed}`);
    return Response.json({ success: true, tomorrow, matched, sent, failed });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
