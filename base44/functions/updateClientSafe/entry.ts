import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// SECURITY: Explicit whitelist of updatable Client fields
const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'email',
  'phone',
  'address',
  'rfc',
  'notes',
  'status',
  'force_wholesale_all_products',
  'force_purchase_all_products'
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { client_id, updates } = body;

    if (!client_id || !updates) {
      return Response.json({ success: false, error: 'client_id and updates are required' }, { status: 400 });
    }

    // Fetch client to validate ownership
    const clients = await base44.entities.Client.filter({ id: client_id });
    if (clients.length === 0) {
      return Response.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    const client = clients[0];

    // CRITICAL: Validate business_id ownership (cross-tenant protection)
    if (client.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // SECURITY: Filter updates through whitelist (mass assignment protection)
    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return Response.json({ success: true, client_id, client, message: 'No valid fields to update' });
    }

    // VALIDATION: Mutually exclusive pricing flags
    const newForceWholesale = sanitized.force_wholesale_all_products ?? client.force_wholesale_all_products ?? false;
    const newForcePurchase = sanitized.force_purchase_all_products ?? client.force_purchase_all_products ?? false;

    if (newForceWholesale && newForcePurchase) {
      return Response.json({
        success: false,
        error: 'No es posible activar "precio mayoreo" y "precio de compra" al mismo tiempo. Desactiva uno antes de activar el otro.'
      }, { status: 400 });
    }

    const updated = await base44.entities.Client.update(client_id, sanitized);

    return Response.json({ success: true, client_id, client: updated });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});