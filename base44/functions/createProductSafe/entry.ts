import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name, business_id,
      sku, barcode, description, category, supplier,
      purchase_price,
      retail_sale_price, wholesale_sale_price,
      stock, min_stock, unit, tax_rate, image_url, status
    } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }

    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Unauthorized: business_id mismatch' }, { status: 403 });
    }

    if (!name || !name.trim()) {
      return Response.json({ success: false, error: 'El nombre del producto es requerido' }, { status: 400 });
    }

    if (retail_sale_price == null || retail_sale_price < 0) {
      return Response.json({ success: false, error: 'El precio menudeo es requerido y no puede ser negativo' }, { status: 400 });
    }

    if (wholesale_sale_price != null && wholesale_sale_price < 0) {
      return Response.json({ success: false, error: 'El precio mayoreo no puede ser negativo' }, { status: 400 });
    }

    if (purchase_price != null && purchase_price < 0) {
      return Response.json({ success: false, error: 'El precio de compra no puede ser negativo' }, { status: 400 });
    }

    const product = await base44.entities.Product.create({
      name,
      business_id,
      sku,
      barcode,
      description,
      category,
      supplier,
      purchase_price,
      retail_sale_price,
      wholesale_sale_price,
      stock,
      min_stock,
      unit,
      tax_rate,
      image_url,
      status
    });

    return Response.json({ success: true, product_id: product.id, product });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});