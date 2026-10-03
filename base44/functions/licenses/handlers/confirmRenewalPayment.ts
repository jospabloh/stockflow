import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getAuthUser } from '../../../shared/authUser.ts';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });

    const body = await req.json();
    const { business_id, payment_reference } = body;

    if (!business_id) return Response.json({ error: 'business_id is required' }, { status: 400 });

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    const business = businesses[0];
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

    if (business.billing_status !== 'active') {
      return Response.json({ error: 'Business is not active — payment confirmation only applies to active licenses' }, { status: 422 });
    }

    if (payment_reference) {
      await base44.asServiceRole.entities.Business.update(business_id, { payment_reference });
    }

    const tenantUsers = await base44.asServiceRole.entities.User.filter({ business_id });
    const admins = tenantUsers
      .filter((u) => (u.role === 'admin' || u.role === 'owner') && u.email)
      .map((u) => ({ email: u.email, full_name: u.full_name || null }));

    const jobs = admins.map((a) => ({
      email_type: 'payment_received',
      recipient_email: a.email,
      recipient_name: a.full_name,
      business_id,
      business_name: business.name || 'tu negocio',
      license_plan: business.license_plan ?? null,
      license_expires_at: business.license_expires_at ?? null,
    }));

    let dispatchResult = null;

    if (jobs.length > 0) {
      try {
        // jobs.sendLifecycleEmails solo acepta x-cron-secret (header o body) o al platform owner;
        // un invoke con service role no es ninguno, asi que el secreto va en el body.
        // En el runtime desplegado invoke devuelve la respuesta axios completa ({data, status, config,
        // request...}), con referencias circulares: nunca se serializa cruda. Patron de applyStock.ts.
        const resp = await base44.asServiceRole.functions.invoke('jobs', {
          action: 'sendLifecycleEmails',
          jobs,
          'x-cron-secret': Deno.env.get('CRON_SECRET'),
        });
        dispatchResult = resp?.data ?? resp;
        // deno-lint-ignore no-explicit-any
        const dr0 = dispatchResult as any;
        console.log('[confirmRenewalPayment] payment_received dispatched:', JSON.stringify({ sent: dr0?.sent, failed: dr0?.failed }));
        // Respuesta sin contador sent, o todo fallido: no es un envio exitoso.
        // deno-lint-ignore no-explicit-any
        const dr = dispatchResult as any;
        if (!dr || typeof dr.sent !== 'number' || (dr.sent === 0 && (dr.failed ?? 0) > 0)) {
          throw new Error(`jobs.sendLifecycleEmails no envio correos: sent=${dr?.sent} failed=${dr?.failed} error=${dr?.error ?? 'n/a'}`);
        }

        // Audit log in EmailNotification
        const nowAudit = new Date().toISOString();
        for (const job of jobs) {
          try {
            await base44.asServiceRole.entities.EmailNotification.create({
              business_id: job.business_id,
              email_type: job.email_type,
              recipient_email: job.recipient_email,
              status: 'sent',
              sent_at: nowAudit,
              idempotency_key: `${job.email_type}:${job.business_id}:${job.recipient_email}:${nowAudit.slice(0, 10)}`,
            });
          } catch (_) {}
        }
      } catch (sendErr) {
        // deno-lint-ignore no-explicit-any
        const se = sendErr as any;
        const errData = se?.response?.data ?? se?.data;
        const sendMsg = String(errData?.error || errData?.message || se?.message || se).slice(0, 500);
        console.error('[confirmRenewalPayment] jobs.sendLifecycleEmails error:', sendMsg);
        dispatchResult = { error: sendMsg };
      }
    }

    // deno-lint-ignore no-explicit-any
    const dispatchFailed = jobs.length > 0 && Boolean((dispatchResult as any)?.error);
    return Response.json({
      success: true,
      business_id,
      recipients: admins.length,
      dispatch: dispatchResult,
      // El pago queda confirmado aunque el correo falle, pero el fallo debe ser visible.
      ...(dispatchFailed && { email_dispatch_failed: true }),
    });

  } catch (error) {
    console.error('[confirmRenewalPayment] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}