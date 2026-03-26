import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
      business_name_from_lookup: null,
      categories_count: 0,
      products_count: 0,
      products_business_ids: [],
      error: null
    };

    // Lookup business name
    if (user.business_id) {
      try {
        const businesses = await base44.entities.Business.filter({ id: user.business_id });
        if (businesses.length > 0) {
          result.business_name_from_lookup = businesses[0].name;
        }
      } catch (e) {
        result.error = `Could not lookup business: ${e.message}`;
      }
    }

    // Get all categories visible to this user
    try {
      const categories = await base44.entities.Category.list();
      result.categories_count = categories.length;
    } catch (e) {
      console.log(`[VERIFY-TENANT] Could not list categories: ${e.message}`);
    }

    // Get all products visible to this user
    try {
      const products = await base44.entities.Product.list();
      result.products_count = products.length;
      
      // Extract unique business_ids from products
      const uniqueBusinessIds = [...new Set(products.map(p => p.business_id))];
      result.products_business_ids = uniqueBusinessIds;
      
      // Check if all products belong to the user's business
      const allCorrectBusiness = products.every(p => p.business_id === user.business_id);
      result.all_products_correct_business = allCorrectBusiness;
      
      if (!allCorrectBusiness) {
        result.warning = `Products from ${uniqueBusinessIds.length} different business(es) found! Should only be 1.`;
      }
    } catch (e) {
      console.log(`[VERIFY-TENANT] Could not list products: ${e.message}`);
    }

    return Response.json(result);

  } catch (error) {
    console.log(`[VERIFY-TENANT] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});