import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('=== DEBUG getCurrentTenantLicenseState ===');
    console.log('Current user email:', user.email);
    console.log('Current user business_id:', user.business_id);
    console.log('Current user id:', user.id);

    if (!user.business_id) {
      console.log('ABORT: user.business_id is empty');
      return Response.json({
        debug: 'user.business_id is null/empty',
        user: { email: user.email, id: user.id, business_id: user.business_id }
      });
    }

    // Fetch the exact business for this user
    console.log('Fetching business with id:', user.business_id);
    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses?.[0];

    console.log('Business result:', biz);
    if (!biz) {
      return Response.json({
        debug: 'business not found',
        user: { email: user.email, id: user.id, business_id: user.business_id },
        businesses_found: businesses || [],
      });
    }

    // Fetch all users for this tenant
    const allUsers = await base44.asServiceRole.entities.User.list();
    console.log('Total users in system:', allUsers.length);

    const tenantUsers = allUsers.filter(u => u.business_id === biz.id);
    console.log('Tenant users for business_id', biz.id, ':', tenantUsers.length);
    console.log('Tenant user emails:', tenantUsers.map(u => u.email));

    console.log('=== END DEBUG ===');

    return Response.json({
      debug: 'success',
      authenticated_user: {
        email: user.email,
        id: user.id,
        business_id: user.business_id,
      },
      resolved_business: {
        id: biz.id,
        name: biz.name,
        billing_status: biz.billing_status,
        license_plan: biz.license_plan,
        trial_end_at: biz.trial_end_at,
        licensed_user_limit: biz.licensed_user_limit,
        license_activated_at: biz.license_activated_at,
      },
      tenant_users: {
        count: tenantUsers.length,
        emails: tenantUsers.map(u => u.email),
      },
    });
  } catch (error) {
    console.error('debugCurrentTenantLicense error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});