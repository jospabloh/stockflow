import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * VERIFY ALL USER CONTEXTS
 * For Jose, Karla, and Roseta:
 * - auth user.business_id
 * - visible business name
 * - Settings loaded business
 * - Categories save target
 * - Products save target
 * All must match the same business_id
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = {
      current_user: {
        email: user.email,
        full_name: user.full_name
      },
      context_verification: {
        auth_user_business_id: user.business_id,
        visible_business: null,
        settings_business: null,
        categories_save_target: user.business_id,
        products_save_target: user.business_id,
        all_match: false,
        mismatches: []
      }
    };

    try {
      // Get visible business name
      if (user.business_id) {
        const businesses = await base44.entities.Business.filter({ id: user.business_id });
        if (businesses.length > 0) {
          result.context_verification.visible_business = {
            business_id: user.business_id,
            name: businesses[0].name
          };
        }
      }
    } catch (e) {
      result.context_verification.visible_business = { error: e.message };
    }

    try {
      // Get settings loaded business
      if (user.business_id) {
        const settings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
        if (settings.length > 0) {
          result.context_verification.settings_business = {
            business_id: settings[0].business_id,
            name: settings[0].business_name || '[Name from AppSettings]'
          };
        }
      }
    } catch (e) {
      result.context_verification.settings_business = { error: e.message };
    }

    // Verify all match
    const authId = result.context_verification.auth_user_business_id;
    const visibleId = result.context_verification.visible_business?.business_id;
    const settingsId = result.context_verification.settings_business?.business_id;
    const catId = result.context_verification.categories_save_target;
    const prodId = result.context_verification.products_save_target;

    if (authId !== visibleId) {
      result.context_verification.mismatches.push(`auth (${authId}) !== visible (${visibleId})`);
    }
    if (authId !== settingsId) {
      result.context_verification.mismatches.push(`auth (${authId}) !== settings (${settingsId})`);
    }
    if (authId !== catId) {
      result.context_verification.mismatches.push(`auth (${authId}) !== categories (${catId})`);
    }
    if (authId !== prodId) {
      result.context_verification.mismatches.push(`auth (${authId}) !== products (${prodId})`);
    }

    result.context_verification.all_match = result.context_verification.mismatches.length === 0;

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});