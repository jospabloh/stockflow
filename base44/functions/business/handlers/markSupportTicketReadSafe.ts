import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

// markSupportTicketReadSafe — clears `unread_for_tenant` when the tenant opens a
// thread. It exists only so SupportTicket.update can be closed to direct tenant
// writes; it touches that one flag and nothing else.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const businessId = user.business_id;
    if (!businessId) return Response.json({ error: 'Forbidden: no business_id' }, { status: 403 });

    if (!(await hasPermission(base44.asServiceRole, user, 'Centro de Soporte', 'view'))) {
      return Response.json(
        { error: 'Forbidden: missing permission', permission: 'Centro de Soporte:view' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const ticket = body?.ticket_id
      ? await base44.asServiceRole.entities.SupportTicket.get(body.ticket_id).catch(() => null)
      : null;
    if (!ticket || ticket.business_id !== businessId) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.unread_for_tenant) {
      await base44.asServiceRole.entities.SupportTicket.update(ticket.id, { unread_for_tenant: false });
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
