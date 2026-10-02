import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { campaignEmail } from './emailTemplates.ts';
import { hasPermission } from './_permissions.ts';

const MAX_RECIPIENTS = 300;

// Envía una campaña/aviso por correo a un segmento de Contactos o a los inscritos de un curso.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      business_id, title, audience_type, tags, status, course_id, enrollment_status,
      subject, body: message, audience_desc
    } = body;

    if (!business_id || business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Unauthorized: business_id mismatch' }, { status: 403 });
    }
    if (!message?.trim()) {
      return Response.json({ success: false, error: 'El mensaje es requerido' }, { status: 400 });
    }

    // PERMISSION CHECK — RLS/role only isolate tenants; the granular key is enforced here.
    if (!(await hasPermission(base44.asServiceRole, user, 'Campañas', 'send'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Campañas:send' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }
    const businessName = biz?.name || '';

    // Resolve recipients as [{ email, name }]
    let recipients: { email: string; name: string }[] = [];
    if (audience_type === 'course') {
      if (!course_id) return Response.json({ success: false, error: 'course_id requerido' }, { status: 400 });
      const enrolls = await base44.asServiceRole.entities.Enrollment.filter({ business_id, course_id }, '-created_date', 1000);
      const seen = new Set<string>();
      for (const e of enrolls) {
        if (enrollment_status && e.status !== enrollment_status) continue;
        const em = (e.contact_email || '').trim().toLowerCase();
        if (!em || seen.has(em)) continue;
        seen.add(em);
        recipients.push({ email: e.contact_email.trim(), name: e.contact_name || '' });
      }
    } else {
      const wanted = Array.isArray(tags) ? tags.filter(Boolean) : [];
      const contacts = await base44.asServiceRole.entities.Contact.filter({ business_id }, '-created_date', 2000);
      const seen = new Set<string>();
      for (const c of contacts) {
        if ((status && c.status !== status) || (!status && c.status === 'inactive')) continue;
        if (wanted.length > 0) {
          const ctags = Array.isArray(c.tags) ? c.tags : [];
          if (!wanted.some((t: string) => ctags.includes(t))) continue;
        }
        const em = (c.email || '').trim().toLowerCase();
        if (!em || seen.has(em)) continue;
        seen.add(em);
        recipients.push({ email: c.email.trim(), name: c.name || '' });
      }
    }

    const total = recipients.length;
    const capped = recipients.slice(0, MAX_RECIPIENTS);

    let sent = 0, failed = 0;
    for (const r of capped) {
      try {
        const tpl = campaignEmail({ businessName, contactName: r.name, subject: subject || '', body: message });
        await base44.asServiceRole.integrations.Core.SendEmail({ to: r.email, subject: tpl.subject, body: tpl.html, from_name: businessName || 'Cursos' });
        sent++;
      } catch (_) {
        failed++;
      }
    }

    // Log the campaign
    try {
      await base44.entities.Campaign.create({
        business_id,
        title: (title || subject || 'Campaña').slice(0, 120),
        channel: 'email',
        audience_type: audience_type === 'course' ? 'course' : 'contacts',
        audience_desc: audience_desc || '',
        course_id: audience_type === 'course' ? (course_id || '') : '',
        subject: subject || '',
        body: message,
        recipients_count: total,
        sent_count: sent,
        failed_count: failed,
        sent_at: new Date().toISOString(),
      });
    } catch (_) { /* logging best-effort */ }

    return Response.json({ success: true, recipients: total, sent, failed, capped: total > MAX_RECIPIENTS ? MAX_RECIPIENTS : total });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
