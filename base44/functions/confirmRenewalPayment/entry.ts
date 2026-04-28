import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.email !== PLATFORM_OWNER_EMAIL) return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });

    const body = await req.json();
    const { business_id, payment_reference } = body;

    if (!business_id) return Response.json({ error: 'business_id is required' }, { status: 400 });

    const [business] = await base44.asServiceRole.entities.Business.filter({ id: business_id });
    if (!business) return Response.json({ error: 'Business not found' }, { status: 404 });

    if (business.billing_status !== 'active') {
      return Response.json({ error: 'Business is not active — payment confirmation only applies to active licenses' }, { status: 422 });
    }

    if (payment_reference) {
      await base44.asServiceRole.entities.Business.update(business_id, { payment_reference });
    }

    const tenantUsers = await base44.asServiceRole.entities.User.filter({ business_id });
    const admins = tenantUsers
      .filter((u: any) => u.role === 'admin' && u.email)
      .map((u: any) => ({ email: u.email, full_name: u.full_name || null }));

    const jobs = admins.map((a: { email: string; full_name: string | null }) => ({
      email_type: 'payment_received',
      recipient_email: a.email,
      recipient_name: a.full_name,
      business_id,
      business_name: business.name || 'tu negocio',
      license_plan: business.license_plan ?? null,
      license_expires_at: business.license_expires_at ?? null,
    }));

    let dispatchResult: any = null;
    const appUrl = Deno.env.get('APP_URL');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (jobs.length > 0 && appUrl) {
      const sendHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cronSecret) sendHeaders['x-cron-secret'] = cronSecret;
      const authHeader = req.headers.get('authorization');
      if (authHeader) sendHeaders['Authorization'] = authHeader;

      const sendResp = await fetch(`${appUrl}/functions/v1/sendLifecycleEmails`, {
        method: 'POST',
        headers: sendHeaders,
        body: JSON.stringify({ jobs }),
      });
      dispatchResult = await sendResp.json();
      console.log('[confirmRenewalPayment] payment_received dispatched:', JSON.stringify(dispatchResult));
    }

    return Response.json({
      success: true,
      business_id,
      recipients: admins.length,
      dispatch: dispatchResult,
    });

  } catch (error: any) {
    console.error('[confirmRenewalPayment] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
