import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
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
        // El guard de jobs.sendLifecycleEmails exige CRON_SECRET (header o body) o dueño de plataforma.
        // asServiceRole.invoke no lleva sesión de dueño: sin el secreto la llamada da 401 y el correo no sale.
        // Mismo patrón que movements/quotations -> pettyCash (secreto en el body).
        dispatchResult = await base44.asServiceRole.functions.invoke('jobs', {
          'x-cron-secret': Deno.env.get('CRON_SECRET'),
          action: 'sendLifecycleEmails',
          jobs,
        });
        console.log('[confirmRenewalPayment] payment_received dispatched:', JSON.stringify(dispatchResult));

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
        console.error('[confirmRenewalPayment] jobs.sendLifecycleEmails error:', (sendErr as Error).message);
        dispatchResult = { error: (sendErr as Error).message };
      }
    }

    return Response.json({
      success: true,
      business_id,
      recipients: admins.length,
      dispatch: dispatchResult,
    });

  } catch (error) {
    console.error('[confirmRenewalPayment] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}