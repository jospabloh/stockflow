import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId, businessId } = await req.json();

    if (!productId || !businessId) {
      return Response.json({ error: 'Missing productId or businessId' }, { status: 400 });
    }

    // Generate unique barcode: timestamp + random + business prefix
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newBarcode = `${timestamp}${random}`;

    // Verify uniqueness across all products in the business
    const allProducts = await base44.entities.Product.filter({ business_id: businessId });
    const barcodeExists = allProducts.some(p => p.barcode === newBarcode);

    if (barcodeExists) {
      // Retry once if collision (very unlikely)
      const timestamp2 = Date.now().toString(36).toUpperCase();
      const random2 = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newBarcode2 = `${timestamp2}${random2}`;
      return Response.json({ barcode: newBarcode2, generated: true });
    }

    return Response.json({ barcode: newBarcode, generated: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});