import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const diagnosis = {
      user_email: user.email,
      user_full_name: user.full_name,
      user_business_id_in_db: user.business_id,
      sidebar_would_show: null,
      settings_would_load: null,
      save_would_target: null,
      categories_would_save_to: null,
      products_would_save_to: null
    };

    // What business would sidebar display?
    if (user.business_id) {
      try {
        const businesses = await base44.entities.Business.filter({ id: user.business_id });
        if (businesses.length > 0) {
          diagnosis.sidebar_would_show = {
            business_id: user.business_id,
            business_name: businesses[0].name
          };
        }
      } catch (e) {
        diagnosis.sidebar_would_show = { error: e.message };
      }
    }

    // What would Settings load?
    try {
      const settings = await base44.entities.AppSettings.list();
      if (settings.length > 0) {
        diagnosis.settings_would_load = {
          business_id: settings[0].business_id,
          business_name: settings[0].business_name,
          from_db: true
        };
      } else {
        diagnosis.settings_would_load = { error: 'No AppSettings record found' };
      }
    } catch (e) {
      diagnosis.settings_would_load = { error: e.message };
    }

    // Where would saves target?
    diagnosis.save_would_target = user.business_id;
    diagnosis.categories_would_save_to = user.business_id;
    diagnosis.products_would_save_to = user.business_id;

    return Response.json(diagnosis);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});