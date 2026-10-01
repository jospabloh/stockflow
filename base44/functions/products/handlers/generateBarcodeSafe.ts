import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ---- EAN-13 logic (inlined — no local imports allowed in Deno functions) ----

function stringToNumericSeed(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  const positive = Math.abs(hash) % 1_000_000_000;
  return String(positive).padStart(9, "0");
}

function calculateEAN13CheckDigit(base12) {
  let oddSum = 0;
  let evenSum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(base12[i], 10);
    if ((i + 1) % 2 === 1) oddSum += d;
    else evenSum += d;
  }
  const total = oddSum + evenSum * 3;
  return (10 - (total % 10)) % 10;
}

function generateInternalProductEAN13(productId, attempt = 0) {
  const prefix = "290";
  const seed = stringToNumericSeed(`${productId}-${attempt}`);
  const base12 = prefix + seed;
  const checkDigit = calculateEAN13CheckDigit(base12);
  return base12 + String(checkDigit);
}

// -------------------------------------------------------------------------

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { product_id } = await req.json();

    if (!product_id) {
      return Response.json({ success: false, error: 'product_id is required' }, { status: 400 });
    }

    // Load the product — RLS ensures it belongs to user's business
    const products = await base44.entities.Product.filter({ id: product_id, business_id: user.business_id });
    if (!products || products.length === 0) {
      return Response.json({ success: false, error: 'Producto no encontrado o sin acceso' }, { status: 404 });
    }

    const product = products[0];

    // Never overwrite an existing barcode
    if (product.barcode && product.barcode.trim() !== "") {
      return Response.json({ success: false, error: 'El producto ya tiene un código de barras' }, { status: 409 });
    }

    // Try up to 20 deterministic attempts. Probe each candidate with a
    // targeted filter (business_id + barcode) instead of loading the entire
    // product catalog into memory: each check returns at most one row, so the
    // cost is independent of how many products the business has. The seed is
    // derived from the product id, so attempt 0 succeeds in practically every
    // case — the common path is a single small query.
    const MAX_ATTEMPTS = 20;
    let barcode = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = generateInternalProductEAN13(product.id, attempt);
      const collisions = await base44.entities.Product.filter({
        business_id: user.business_id,
        barcode: candidate,
      });
      if (!collisions || collisions.length === 0) {
        barcode = candidate;
        break;
      }
    }

    if (!barcode) {
      return Response.json({ success: false, error: 'No se pudo generar un código único tras 20 intentos' }, { status: 500 });
    }

    // Save barcode to product — pass all existing fields to avoid schema validation errors on legacy products
    const updatePayload = {
      ...product,
      barcode,
      // Normalize legacy field name
      retail_sale_price: product.retail_sale_price ?? product.sale_price ?? 0,
    };
    // Remove computed/readonly fields that shouldn't be sent
    delete updatePayload.id;
    delete updatePayload.created_date;
    delete updatePayload.updated_date;
    delete updatePayload.created_by;
    delete updatePayload.sale_price; // remove legacy field

    const updated = await base44.entities.Product.update(product.id, updatePayload);

    return Response.json({ success: true, barcode, product: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}