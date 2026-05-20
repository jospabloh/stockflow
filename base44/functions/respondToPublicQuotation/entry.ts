import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { token, action, client_notes } = body;

    if (!token) return Response.json({ error: 'token is required' }, { status: 400 });
    if (!action || !['accepted', 'rejected'].includes(action)) {
      return Response.json({ error: 'action must be "accepted" or "rejected"' }, { status: 400 });
    }

    const quotations = await base44.asServiceRole.entities.Quotation.filter({
      public_token: token,
      public_link_enabled: true,
    });

    if (quotations.length === 0) {
      return Response.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const q = quotations[0];

    if (q.status !== 'sent') {
      return Response.json(
        { error: `Quotation cannot be responded to in status "${q.status}"` },
        { status: 409 },
      );
    }

    const newStatus = action === 'accepted' ? 'accepted' : 'cancelled';
    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (client_notes) updatePayload.notes = client_notes;

    await base44.asServiceRole.entities.Quotation.update(q.id, updatePayload);

    return Response.json({ success: true, status: newStatus });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
