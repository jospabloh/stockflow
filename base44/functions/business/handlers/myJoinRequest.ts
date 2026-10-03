import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { getAuthUser } from '../../../shared/authUser.ts';

// myJoinRequest — the requester's own most recent join request, so the
// "Solicitud enviada, esperando aprobación" screen survives a reload. Only the
// caller's own rows (user_id from the session). A 'rejected' one is returned
// too so the user learns the decision instead of a silent reset; 'approved'
// shows up as business_id on the user, so it is not needed here.
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await base44.asServiceRole.entities.JoinRequest.filter({ user_id: user.id }, '-created_date', 5);
    const latest = rows.find((r: { status?: string }) => r.status === 'pending' || r.status === 'rejected') || null;
    if (!latest) return Response.json({ success: true, request: null });

    return Response.json({
      success: true,
      request: {
        id: latest.id,
        status: latest.status,
        business_id: latest.business_id,
        business_name: latest.business_name ?? null,
        created_date: latest.created_date ?? null,
        decided_at: latest.decided_at ?? null,
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
