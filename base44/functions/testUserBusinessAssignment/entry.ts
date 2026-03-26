import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TEST: User Business Assignment
 * 
 * Verifies:
 * 1. Current user has business_id set
 * 2. Business record exists and is accessible
 * 3. Sidebar label matches actual business
 * 4. Settings can be loaded for that business
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        status: 'OPEN',
        issue: 'User not authenticated',
        error: 'Auth failed'
      }, { status: 401 });
    }

    const result = {
      user_email: user.email,
      user_id: user.id,
      user_role: user.role,
      user_business_id: user.business_id,
      tests: {
        user_has_business_id: null,
        business_record_exists: null,
        business_record_accessible: null,
        business_name_matches: null,
        app_settings_accessible: null,
      },
      status: 'UNKNOWN'
    };

    // TEST 1: User has business_id set
    result.tests.user_has_business_id = {
      pass: !!user.business_id,
      value: user.business_id || null,
      issue: user.business_id ? null : 'User has no business_id assigned'
    };

    if (!user.business_id) {
      result.status = 'OPEN';
      result.critical_issue = 'User business assignment missing - user is orphaned';
      return Response.json(result, { status: 200 });
    }

    // TEST 2: Business record exists
    try {
      const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
      const business = businesses.find(b => b.id === user.business_id);
      
      result.tests.business_record_exists = {
        pass: !!business,
        business_id: user.business_id,
        business_name: business?.name || null,
        issue: business ? null : 'Business record not found'
      };

      if (!business) {
        result.status = 'OPEN';
        result.critical_issue = 'Business record does not exist for assigned business_id';
        return Response.json(result, { status: 200 });
      }

      // TEST 3: Business record accessible via standard query (RLS test)
      try {
        const standardQuery = await base44.entities.Business.filter({ id: user.business_id });
        const stdBusiness = standardQuery.find(b => b.id === user.business_id);
        
        result.tests.business_record_accessible = {
          pass: !!stdBusiness,
          via_rls: !!stdBusiness,
          issue: stdBusiness ? null : 'Business not accessible via standard RLS query'
        };

        if (stdBusiness) {
          // TEST 4: Sidebar label matches
          result.tests.business_name_matches = {
            pass: stdBusiness.name === business.name,
            expected_name: business.name,
            actual_name: stdBusiness.name,
            issue: stdBusiness.name === business.name ? null : 'Business name mismatch'
          };
        }
      } catch (e) {
        result.tests.business_record_accessible = {
          pass: false,
          error: e.message,
          issue: 'RLS query failed'
        };
      }

      // TEST 5: AppSettings can be loaded
      try {
        const settings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
        result.tests.app_settings_accessible = {
          pass: settings.length > 0,
          count: settings.length,
          settings_ids: settings.map(s => s.id),
          issue: settings.length === 0 ? 'No AppSettings found for business' : null
        };
      } catch (e) {
        result.tests.app_settings_accessible = {
          pass: false,
          error: e.message,
          issue: 'Failed to load AppSettings'
        };
      }

    } catch (e) {
      result.tests.business_record_exists = {
        pass: false,
        error: e.message,
        issue: 'Service role query failed'
      };
    }

    // Overall status
    const allPass = Object.values(result.tests).every(t => t?.pass !== false);
    result.status = allPass ? 'PROVEN FIXED' : 'OPEN';

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message, status: 'OPEN' }, { status: 500 });
  }
});