import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items, client_id } = await req.json();

    if (!items || !Array.isArray(items)) {
      return Response.json({ error: 'Items array required' }, { status: 400 });
    }

    // Get client to check force_purchase_all_products.
    // Scope the lookup to the authenticated user's business_id to prevent
    // cross-tenant data access (a malicious user could otherwise pass a
    // client_id belonging to another business).
    let client = null;
    if (client_id) {
      const clients = await base44.asServiceRole.entities.Client.filter({
        id: client_id,
        business_id: user.business_id
      });
      client = clients[0] || null;
    }

    // Calculate subtotal and tax
    let subtotal = 0;
    let tax = 0;

    items.forEach(item => {
      if (item.tax_rate === 16) {
        const netBase = Math.round((item.total / 1.16) * 100) / 100;
        const itemTax = Math.round((item.total - netBase) * 100) / 100;
        subtotal += netBase;
        tax += itemTax;
      } else {
        subtotal += item.total;
      }
    });

    subtotal = Math.round(subtotal * 100) / 100;
    tax = Math.round(tax * 100) / 100;

    // Apply transport fee if client has force_purchase_all_products
    const transportFee = (client?.force_purchase_all_products === true) ? (20 * items.length) : 0;
    const total = Math.round((subtotal + tax + transportFee) * 100) / 100;

    return Response.json({
      success: true,
      subtotal,
      tax,
      transportFee,
      total,
      hasTransport: client?.force_purchase_all_products === true
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}