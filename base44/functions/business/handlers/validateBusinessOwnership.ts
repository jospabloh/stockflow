import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

export async function handle(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    
    if (!user || !user.business_id) {
      return Response.json({ error: 'Unauthorized or no business assigned' }, { status: 401 });
    }

    const { entity_name, record_id, operation } = await req.json();
    
    if (!entity_name || !record_id) {
      return Response.json({ error: 'entity_name and record_id required' }, { status: 400 });
    }

    // Whitelist of entities that can be validated through this endpoint.
    // All of them carry a `business_id` field used for the tenant check below.
    // Restricting the parameter prevents probing arbitrary entities (e.g. User,
    // Session, SupportTicket) for cross-tenant record enumeration.
    const ALLOWED_ENTITIES = new Set([
      'Product', 'Category', 'Supplier', 'Client', 'PaymentMethod',
      'Quotation', 'Movement', 'Rubro', 'FundAccount', 'PettyCashMovement',
      'UtilityMovement', 'Campaign', 'PermissionProfile', 'AppSettings',
      'Contact', 'Course', 'Enrollment', 'Session', 'SupplierPayment',
      'SupportTicket', 'SupportTicketMessage', 'InventoryAuditLog',
    ]);
    if (!ALLOWED_ENTITIES.has(entity_name)) {
      return Response.json({ valid: false, reason: 'Unauthorized or invalid record' });
    }

    // Fetch record using service role to bypass RLS. The SDK throws on invalid
    // / non-existent ids, so wrap the call and surface the same unified message
    // used for cross-tenant mismatches — this avoids a side-channel where an
    // attacker distinguishes "record does not exist" from "record belongs to
    // another tenant" by comparing error vs. valid responses.
    let record;
    try {
      const records = await base44.asServiceRole.entities[entity_name].filter({ id: record_id });
      if (records.length === 0) {
        return Response.json({ valid: false, reason: 'Unauthorized or invalid record' });
      }
      record = records[0];
    } catch (error) {
      console.error('[validateBusinessOwnership] lookup error', error);
      return Response.json({ valid: false, reason: 'Unauthorized or invalid record' });
    }

    // Validate record belongs to user's business
    if (record.business_id !== user.business_id) {
      console.error(`[validateBusinessOwnership] CROSS-BUSINESS ATTEMPT: User ${user.email} (business ${user.business_id}) tried ${operation} on ${entity_name} ${record_id} (business ${record.business_id})`);
      return Response.json({ valid: false, reason: 'Unauthorized or invalid record' });
    }

    return Response.json({ 
      valid: true, 
      record_id,
      entity_name,
      operation
    });
    
  } catch (error) {
    console.error('[validateBusinessOwnership]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}