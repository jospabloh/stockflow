import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { business_id, name, sale_price } = await req.json();

    // VALIDATION 1: business_id required
    if (!business_id) {
      return Response.json({ 
        success: false, 
        error: 'business_id is required' 
      }, { status: 400 });
    }

    // VALIDATION 2: business_id must match user's business
    if (business_id !== user.business_id) {
      return Response.json({ 
        success: false, 
        error: `Unauthorized: business_id mismatch (user: ${user.business_id}, provided: ${business_id})` 
      }, { status: 403 });
    }

    // If validations pass, create the product
    const product = await base44.entities.Product.create({
      name,
      sale_price,
      business_id
    });

    return Response.json({ 
      success: true, 
      product_id: product.id 
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});