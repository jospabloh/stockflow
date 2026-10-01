import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// cancelJoinRequest — the requester withdraws their own pending request (the
// only way to ask another business, since a pending request blocks a second
// one). The request is re-read from storage and must belong to the caller.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;
    const pending = await sr.entities.JoinRequest.filter({ user_id: user.id, status: 'pending' });
    for (const r of pending) {
      await sr.entities.JoinRequest.update(r.id, { status: 'canceled', decided_at: new Date().toISOString() });
    }
    return Response.json({ success: true, canceled: pending.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
