import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { authorFields, CATEGORIES, clip, MAX_BODY, MAX_SUBJECT, PRIORITIES } from './_supportTicket.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

// createSupportTicketSafe — opens a ticket plus its first message.
//
// Replaces the two direct entity writes SupportTickets.jsx used to make, which
// only checked `Centro de Soporte:create` client-side. Tenant, author and
// business name come from the server, never from the body. The Mission Control
// ticket-pull ping stays client-side: it only carries the id, and MC reads the
// real record over the acaciaControl bridge.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const businessId = user.business_id;
    if (!businessId) return Response.json({ error: 'Forbidden: no business_id' }, { status: 403 });

    if (!(await hasPermission(base44.asServiceRole, user, 'Centro de Soporte', 'create'))) {
      return Response.json(
        { error: 'Forbidden: missing permission', permission: 'Centro de Soporte:create' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const subject = clip(body?.subject, MAX_SUBJECT);
    const description = clip(body?.description, MAX_BODY);
    if (!subject || !description) {
      return Response.json({ error: 'subject and description are required' }, { status: 400 });
    }
    const category = CATEGORIES.has(body?.category) ? body.category : 'other';
    const priority = PRIORITIES.has(body?.priority) ? body.priority : 'normal';

    const business = await base44.asServiceRole.entities.Business.get(businessId).catch(() => null);
    const now = new Date().toISOString();

    // deno-lint-ignore no-explicit-any
    const ticketPayload: Record<string, any> = {
      business_id: businessId,
      business_name: business?.name || '',
      subject,
      description,
      category,
      priority,
      status: 'open',
      created_by_id: user.id,
      created_by_email: user.email,
      unread_for_owner: true,
      unread_for_tenant: false,
      last_message_at: now,
      last_message_by_role: 'tenant',
      messages_count: 1,
    };
    const brief = body?.ai_brief;
    if (brief && typeof brief === 'object' && !Array.isArray(brief)) ticketPayload.ai_brief = brief;

    const ticket = await base44.asServiceRole.entities.SupportTicket.create(ticketPayload);
    await base44.asServiceRole.entities.SupportTicketMessage.create({
      ticket_id: ticket.id,
      business_id: businessId,
      ...authorFields(user),
      body: description,
      is_internal_note: false,
    });

    return Response.json({ success: true, ticket });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
