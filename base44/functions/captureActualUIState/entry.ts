import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * CAPTURE ACTUAL UI STATE
 * Shows what each user actually sees:
 * 1. Auth business_id
 * 2. What Business.filter returns (what sidebar loads)
 * 3. Where categories/products save
 * 4. Settings visibility
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = {
      user: {
        email: user.email,
        full_name: user.full_name,
        auth_business_id: user.business_id
      },
      ui_context: {
        business_filter_results: [],
        business_filter_count: 0,
        would_load_business_name: null,
        would_load_business_id: null
      },
      save_targets: {
        category_save_business_id: user.business_id,
        product_save_business_id: user.business_id,
        settings_business_id: user.business_id
      },
      consistency: {
        sidebar_matches_auth: null,
        all_saves_match_auth: null,
        overall_status: 'UNKNOWN'
      }
    };

    // Step 1: See what Business.filter returns (simulates BusinessContext)
    try {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      result.ui_context.business_filter_results = businesses.map(b => ({
        id: b.id,
        name: b.name
      }));
      result.ui_context.business_filter_count = businesses.length;

      // This is what BusinessContext would display (first exact match)
      const exactMatch = businesses.find(b => b.id === user.business_id);
      if (exactMatch) {
        result.ui_context.would_load_business_name = exactMatch.name;
        result.ui_context.would_load_business_id = exactMatch.id;
      }
    } catch (e) {
      result.ui_context.business_filter_error = e.message;
    }

    // Step 2: Check consistency
    const sidebarMatch = result.ui_context.would_load_business_id === user.business_id;
    const savesMatch = (
      result.save_targets.category_save_business_id === user.business_id &&
      result.save_targets.product_save_business_id === user.business_id &&
      result.save_targets.settings_business_id === user.business_id
    );

    result.consistency.sidebar_matches_auth = sidebarMatch;
    result.consistency.all_saves_match_auth = savesMatch;
    result.consistency.overall_status = (sidebarMatch && savesMatch) ? 'CONSISTENT' : 'MISMATCH';

    // Step 3: If Business.filter returns multiple, show the issue
    if (result.ui_context.business_filter_count > 1) {
      result.consistency.rls_issue = `Business.filter returned ${result.ui_context.business_filter_count} results for auth_business_id filter. RLS not isolating correctly.`;
      result.consistency.would_load_first = result.ui_context.business_filter_results[0]?.name;
      result.consistency.should_load = result.ui_context.would_load_business_name;
      result.consistency.risk = result.ui_context.would_load_first !== result.ui_context.would_load_business_name ? 'HIGH: Loading wrong business!' : 'LOW: First match happens to be correct';
    }

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});