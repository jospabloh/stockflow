import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function calculateEAN13Checksum(code) {
  let sum = 0;
  for (let i = 0; i < code.length; i++) {
    const digit = parseInt(code[i]);
    sum += (i % 2 === 0 ? digit : digit * 3);
  }
  return ((10 - (sum % 10)) % 10).toString();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, businessId } = body;

    if (!productId || !businessId) {
      return Response.json({ error: 'Missing productId or businessId' }, { status: 400 });
    }

    // Get all products from user's business to check uniqueness
    const allProducts = await base44.entities.Product.filter({ business_id: businessId });

    // Generate EAN-13 format: 750 + 9 random digits + 1 checksum
    let newBarcode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const randomPart = Math.floor(Math.random() * 9999999999).toString().padStart(9, "0");
      const baseCode = "750" + randomPart;
      const checksum = calculateEAN13Checksum(baseCode);
      newBarcode = baseCode + checksum;

      isUnique = !allProducts.some(p => p.barcode === newBarcode);
      attempts++;
    }

    if (!isUnique) {
      return Response.json({ error: 'Could not generate unique barcode' }, { status: 500 });
    }

    return Response.json({ barcode: newBarcode, generated: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});