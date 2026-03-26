import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Safe Product creation with business_id validation
 * Rejects if:
 * 1. business_id is missing
 * 2. business_id doesn't match user's business_id
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, sale_price, business_id, sku, barcode, description, category, supplier, purchase_price, min_stock, unit, tax_rate, image_url, status } = body;

    // VALIDATION: business_id required
    if (!business_id) {
      return Response.json({ 
        success: false, 
        error: 'business_id is required' 
      }, { status: 400 });
    }

    // VALIDATION: business_id must match user's business
    if (business_id !== user.business_id) {
      return Response.json({ 
        success: false, 
        error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` 
      }, { status: 403 });
    }

    // All validations passed, create the product
    const product = await base44.entities.Product.create({
      name,
      sale_price,
      business_id,
      sku,
      barcode,
      description,
      category,
      supplier,
      purchase_price,
      min_stock,
      unit,
      tax_rate,
      image_url,
      status
    });

    return Response.json({ 
      success: true, 
      product_id: product.id,
      product
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});