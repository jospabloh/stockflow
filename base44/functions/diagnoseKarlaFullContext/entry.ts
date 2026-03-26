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
      user_business_id: user.business_id,
      user_role: user.role,
      
      // What the sidebar would show
      sidebar_business: {
        business_id: user.business_id,
        business_name_from_db: null
      },
      
      // What Settings would load
      settings_load: {
        business_id: user.business_id,
        record_count: 0,
        first_record: null
      },
      
      // What Categories would be visible
      categories_load: {
        business_id: user.business_id,
        count: 0,
        isolation_check: null
      },
      
      // What Products would be visible
      products_load: {
        business_id: user.business_id,
        count: 0,
        isolation_check: null
      },
      
      // What would be saved to
      save_targets: {
        settings_save_to: user.business_id,
        categories_save_to: user.business_id,
        products_save_to: user.business_id
      }
    };

    // 1. Get the business name for sidebar
    if (user.business_id) {
      try {
        const businesses = await base44.entities.Business.filter({ id: user.business_id });
        if (businesses.length > 0) {
          diagnosis.sidebar_business.business_name_from_db = businesses[0].name;
        }
      } catch (e) {
        diagnosis.sidebar_business.error = e.message;
      }
    }

    // 2. Get Settings that would be loaded
    try {
      const settings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
      diagnosis.settings_load.record_count = settings.length;
      if (settings.length > 0) {
        diagnosis.settings_load.first_record = {
          id: settings[0].id,
          business_id: settings[0].business_id,
          business_name: settings[0].business_name
        };
      }
    } catch (e) {
      diagnosis.settings_load.error = e.message;
    }

    // 3. Get Categories
    try {
      const categories = await base44.entities.Category.filter({ business_id: user.business_id });
      diagnosis.categories_load.count = categories.length;
      
      // Check isolation
      const allCats = await base44.entities.Category.list();
      const isolated = allCats.every(c => c.business_id === user.business_id);
      diagnosis.categories_load.isolation_check = {
        all_categories_count: allCats.length,
        my_categories: categories.length,
        isolation_ok: isolated
      };
    } catch (e) {
      diagnosis.categories_load.error = e.message;
    }

    // 4. Get Products
    try {
      const products = await base44.entities.Product.filter({ business_id: user.business_id });
      diagnosis.products_load.count = products.length;
      
      // Check isolation
      const allProds = await base44.entities.Product.list();
      const isolated = allProds.every(p => p.business_id === user.business_id);
      diagnosis.products_load.isolation_check = {
        all_products_count: allProds.length,
        my_products: products.length,
        isolation_ok: isolated
      };
    } catch (e) {
      diagnosis.products_load.error = e.message;
    }

    return Response.json(diagnosis);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});