import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function calculateEAN13Checksum(code) {
  let sum = 0;
  for (let i = 0; i < code.length; i++) {
    const digit = parseInt(code[i]);
    sum += (i % 2 === 0 ? digit : digit * 3);
  }
  return ((10 - (sum % 10)) % 10).toString();
}

function generateRandomBarcode() {
  const randomPart = Math.floor(Math.random() * 9999999999).toString().padStart(9, "0");
  const baseCode = "750" + randomPart;
  const checksum = calculateEAN13Checksum(baseCode);
  return baseCode + checksum;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { businessId } = body;

    if (!businessId) {
      return Response.json({ error: 'Missing businessId' }, { status: 400 });
    }

    // Generate a random barcode (statistically unique, minimal DB checks)
    const newBarcode = generateRandomBarcode();

    return Response.json({ barcode: newBarcode, generated: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});