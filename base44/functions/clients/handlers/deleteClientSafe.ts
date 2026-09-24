import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { client_id } = body;

    if (!client_id) {
      return Response.json({ error: 'client_id is required' }, { status: 400 });
    }

    // Fetch record via service role to avoid silent 404 from RLS
    const records = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    if (records.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const record = records[0];

    // CRITICAL: Validate tenant ownership — prevent cross-tenant delete
    if (record.business_id !== user.business_id) {
      console.error(
        `[deleteClientSafe] CROSS-TENANT ATTEMPT: user ${user.email} (business ${user.business_id}) ` +
        `tried to delete client ${client_id} (business ${record.business_id})`
      );
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Block if quotations reference this client
    const quots = await base44.asServiceRole.entities.Quotation.filter({
      client_id,
      business_id: user.business_id,
    });
    if (quots.length > 0) {
      return Response.json({
        error: `No se puede eliminar: ${quots.length} cotización(es) están registradas para este cliente.`,
        blocked_by_quotations: quots.length,
      }, { status: 409 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    await base44.asServiceRole.entities.Client.delete(client_id);

    return Response.json({ success: true, client_id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
