import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

// SECURITY: Explicit whitelist of updatable Client fields
const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'business_name',
  'giro',
  'email',
  'phone',
  'address',
  'rfc',
  'notes',
  'status',
  'force_wholesale_all_products',
  'force_purchase_all_products'
]);

export async function handle(req: Request): Promise<Response> {
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

    // Fetch client to validate ownership — use asServiceRole to avoid RLS blocking
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
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

    // VALIDATION: Required fields cannot be blanked out
    const newName = 'name' in sanitized ? sanitized.name : client.name;
    const newBusinessName = 'business_name' in sanitized ? sanitized.business_name : client.business_name;
    const newPhone = 'phone' in sanitized ? sanitized.phone : client.phone;
    if (!newName?.trim() || !newBusinessName?.trim() || !newPhone?.trim()) {
      return Response.json({ success: false, error: 'Nombre de contacto, nombre de negocio y teléfono son requeridos' }, { status: 400 });
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

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz2 = bizArr[0];
    const billingStatus2 = biz2?.billing_status || 'active';
    if (billingStatus2 === 'view_only' || billingStatus2 === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus2 }, { status: 403 });
    }

    // Use asServiceRole for the update — ownership already validated above
    const updated = await base44.asServiceRole.entities.Client.update(client_id, sanitized);

    return Response.json({ success: true, client_id, client: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}