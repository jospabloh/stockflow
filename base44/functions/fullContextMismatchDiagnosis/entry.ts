import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * COMPREHENSIVE DIAGNOSIS:
 * For the current logged-in user, verify all 4 contexts are consistent:
 * 1. Sidebar visible business (from BusinessContext.businessName)
 * 2. Settings loaded business (from AppSettings.filter())
 * 3. Categories save target (businessId from context)
 * 4. Products save target (businessId from context)
 * 
 * Expected: All 4 point to the same business
 * Bug: Karla's sidebar shows ACACIA but Settings shows Baristop
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = {
      user_email: user.email,
      user_full_name: user.full_name,
      user_business_id: user.business_id,
      
      consistency_check: {
        sidebar_visible_business: null,
        settings_loaded_business: null,
        categories_save_target: null,
        products_save_target: null,
        all_match: false,
        mismatches: []
      }
    };

    try {
      // 1. Sidebar would show this business
      if (user.business_id) {
        const businesses = await base44.entities.Business.filter({ id: user.business_id });
        if (businesses.length > 0) {
          result.consistency_check.sidebar_visible_business = {
            business_id: user.business_id,
            business_name: businesses[0].name
          };
        }
      }
    } catch (e) {
      result.consistency_check.sidebar_visible_business = { error: (e as Error).message };
    }

    try {
      // 2. Settings would load this business
      if (user.business_id) {
        const settings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
        if (settings.length > 0) {
          result.consistency_check.settings_loaded_business = {
            business_id: settings[0].business_id,
            business_name: settings[0].business_name,
            appSettings_id: settings[0].id
          };
        } else {
          result.consistency_check.settings_loaded_business = {
            business_id: user.business_id,
            business_name: "[No AppSettings record]",
            note: "AppSettings not configured for this business yet"
          };
        }
      }
    } catch (e) {
      result.consistency_check.settings_loaded_business = { error: (e as Error).message };
    }

    // 3 & 4. Categories and Products save targets
    result.consistency_check.categories_save_target = user.business_id;
    result.consistency_check.products_save_target = user.business_id;

    // Check for mismatches
    const sidebarId = result.consistency_check.sidebar_visible_business?.business_id;
    const settingsId = result.consistency_check.settings_loaded_business?.business_id;
    const catSaveId = result.consistency_check.categories_save_target;
    const prodSaveId = result.consistency_check.products_save_target;

    if (sidebarId !== settingsId) {
      result.consistency_check.mismatches.push(
        `SIDEBAR (${sidebarId}) !== SETTINGS (${settingsId})`
      );
    }
    if (sidebarId !== catSaveId) {
      result.consistency_check.mismatches.push(
        `SIDEBAR (${sidebarId}) !== CATEGORIES SAVE (${catSaveId})`
      );
    }
    if (settingsId !== prodSaveId) {
      result.consistency_check.mismatches.push(
        `SETTINGS (${settingsId}) !== PRODUCTS SAVE (${prodSaveId})`
      );
    }

    result.consistency_check.all_match = result.consistency_check.mismatches.length === 0;

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});