import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Check if user already has a business_id
    if (user.business_id) {
      return Response.json({
        message: 'User already linked to a business',
        business_id: user.business_id,
      }, { status: 200 });
    }

    // Create owner sandbox business
    const sandboxBusiness = await base44.asServiceRole.entities.Business.create({
      name: 'ACACIA OWNER SANDBOX',
      rfc: 'OWNER0000000AAA',
      phone: '+52 000 0000 0000',
      address: 'Owner Sandbox (Development)',
      invite_code: `OWNERDEV${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      invite_code_active: false,
      status: 'active',
      tax_rate: 16,
      currency: 'MXN',
    });

    // Create AppSettings for sandbox
    await base44.asServiceRole.entities.AppSettings.create({
      business_id: sandboxBusiness.id,
      business_name: 'ACACIA OWNER SANDBOX',
      primary_color: '#4F46E5',
      secondary_color: '#06B6D4',
      tax_rate: 16,
      currency: 'MXN',
      logo_url: '',
      address: 'Owner Sandbox (Development)',
      phone: '+52 000 0000 0000',
      rfc: 'OWNER0000000AAA',
      low_stock_email: user.email,
      quotation_footer: 'Owner Sandbox - Development',
    });

    // Link user to sandbox business
    await base44.auth.updateMe({ business_id: sandboxBusiness.id, role: 'admin' });

    return Response.json({
      success: true,
      sandboxBusiness,
      message: 'Owner sandbox created and user linked',
    });
  } catch (error) {
    console.error('Error setting up owner sandbox:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});