import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { checkProductDuplicate, duplicateErrorMessage } from '../../../shared/productDuplicateCheck.ts';

export async function handle(req: Request): Promise<Response> {
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

    // DUPLICATE CHECK — name (case-insensitive), SKU, barcode
    const dup = await checkProductDuplicate(base44, business_id, name, sku, barcode);
    if (dup.duplicate) {
      return Response.json({ success: false, error: duplicateErrorMessage(dup) }, { status: 409 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // Use asServiceRole for the create — business_id ownership already validated above
    const product = await base44.asServiceRole.entities.Product.create({
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
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}