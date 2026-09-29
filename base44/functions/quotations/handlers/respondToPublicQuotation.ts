import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

// Intentionally unauthenticated: the customer accepting/rejecting a shared
// quotation has no Base44 account. Same public_token + public_link_enabled
// gate as getPublicQuotation.ts — see that file for the token's origin.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    // `client_notes` is deliberately NOT read: this endpoint is anonymous (token only), and
    // letting it overwrite Quotation.notes let anyone holding the link rewrite the business's
    // internal notes. The public page never sent it (PublicQuotation.jsx sends token + action).
    const { token, action } = body;

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

    await base44.asServiceRole.entities.Quotation.update(q.id, updatePayload);

    return Response.json({ success: true, status: newStatus });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
