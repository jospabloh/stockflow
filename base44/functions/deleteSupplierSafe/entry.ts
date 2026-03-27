import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { supplier_id } = body;

    if (!supplier_id) {
      return Response.json({ error: 'supplier_id is required' }, { status: 400 });
    }

    // Fetch record to validate ownership
    const records = await base44.entities.Supplier.filter({ id: supplier_id });
    if (records.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const record = records[0];

    // CRITICAL: Validate business_id ownership
    if (record.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check for products using this supplier (scoped to business)
    const products = await base44.entities.Product.filter({ supplier: supplier_id, business_id: user.business_id });
    if (products.length > 0) {
      return Response.json({
        error: `No se puede eliminar: ${products.length} producto(s) tienen este proveedor asignado.`,
        blocked_by_products: products.length
      }, { status: 409 });
    }

    await base44.asServiceRole.entities.Supplier.delete(supplier_id);

    return Response.json({ success: true, supplier_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});