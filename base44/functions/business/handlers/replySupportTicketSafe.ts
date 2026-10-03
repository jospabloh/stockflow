import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { authorFields, clip, MAX_BODY } from './_supportTicket.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

// replySupportTicketSafe — tenant reply on an existing ticket.
//
// The ticket is re-read from the store and checked against the caller's own
// business; the message count and the status come from that stored row, not
// from what the client last saw. A resolved ticket reopens on reply (as the page
// always did); a closed one refuses, matching the UI, which hides the reply box.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const businessId = user.business_id;
    if (!businessId) return Response.json({ error: 'Forbidden: no business_id' }, { status: 403 });

    if (!(await hasPermission(base44.asServiceRole, user, 'Centro de Soporte', 'reply'))) {
      return Response.json(
        { error: 'Forbidden: missing permission', permission: 'Centro de Soporte:reply' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const text = clip(body?.body, MAX_BODY);
    if (!body?.ticket_id || !text) {
      return Response.json({ error: 'ticket_id and body are required' }, { status: 400 });
    }

    const ticket = await base44.asServiceRole.entities.SupportTicket.get(body.ticket_id).catch(() => null);
    if (!ticket || ticket.business_id !== businessId) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }
    if (ticket.status === 'closed') {
      return Response.json({ error: 'ticket_closed' }, { status: 409 });
    }

    await base44.asServiceRole.entities.SupportTicketMessage.create({
      ticket_id: ticket.id,
      business_id: businessId,
      ...authorFields(user),
      body: text,
      is_internal_note: false,
    });
    await base44.asServiceRole.entities.SupportTicket.update(ticket.id, {
      last_message_at: new Date().toISOString(),
      last_message_by_role: 'tenant',
      unread_for_owner: true,
      messages_count: (ticket.messages_count || 0) + 1,
      status: ticket.status === 'resolved' ? 'open' : ticket.status,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
