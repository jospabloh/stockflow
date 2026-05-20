import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * AUDIT ALL THREE USERS' CONTEXTS
 * Admin-only function to verify all three users have correct business assignments
 * and consistent context across all 4 points
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const result = {
      timestamp: new Date().toISOString(),
      audited_users: [
        { email: 'h.josepablo@gmail.com', expected_business: 'ACACIA OWNER SANDBOX' },
        { email: 'karla.baristop@gmail.com', expected_business: 'Baristop Distribuidora' },
        { email: 'roseta.cafeteria@gmail.com', expected_business: 'Baristop Distribuidora' }
      ],
      audit_results: [],
      all_pass: false
    };

    for (const userTarget of result.audited_users) {
      const audit = {
        email: userTarget.email,
        expected_business: userTarget.expected_business,
        context: {},
        mismatches: [],
        pass: false
      };

      try {
        // Find user
        const users = await base44.asServiceRole.entities.User.filter({ email: userTarget.email });
        if (users.length === 0) {
          audit.error = 'User not found';
          result.audit_results.push(audit);
          continue;
        }

        const targetUser = users[0];
        audit.context.auth_user_business_id = targetUser.business_id;

        // Get visible business (use exact ID match to work around RLS filter bug)
        try {
          const businesses = await base44.asServiceRole.entities.Business.filter({ id: targetUser.business_id });
          const exactBusiness = businesses.find(b => b.id === targetUser.business_id);
          if (exactBusiness) {
            audit.context.visible_business_name = exactBusiness.name;
            audit.context.visible_business_id = exactBusiness.id;
          }
        } catch (e) {
          audit.context.visible_business_error = (e as Error).message;
        }

        // Get settings business
        try {
          const settings = await base44.asServiceRole.entities.AppSettings.filter({ business_id: targetUser.business_id });
          if (settings.length > 0) {
            audit.context.settings_business_id = settings[0].business_id;
            audit.context.settings_business_name = settings[0].business_name;
          }
        } catch (e) {
          audit.context.settings_business_error = (e as Error).message;
        }

        // Check consistency
        const authId = audit.context.auth_user_business_id;
        const visibleId = audit.context.visible_business_id;
        const settingsId = audit.context.settings_business_id;

        if (authId !== visibleId) {
          audit.mismatches.push(`auth (${authId}) !== visible (${visibleId})`);
        }
        if (authId !== settingsId) {
          audit.mismatches.push(`auth (${authId}) !== settings (${settingsId})`);
        }

        // Check against expected business
        if (audit.context.visible_business_name !== userTarget.expected_business) {
          audit.mismatches.push(`visible business "${audit.context.visible_business_name}" !== expected "${userTarget.expected_business}"`);
        }

        audit.pass = audit.mismatches.length === 0;
        result.audit_results.push(audit);

      } catch (e) {
        audit.error = (e as Error).message;
        result.audit_results.push(audit);
      }
    }

    result.all_pass = result.audit_results.every(a => a.pass);

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});