import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { hasPermission } from './_permissions.ts';
import { isBusinessAdminRole } from './_joinRequest.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

// listJoinRequests — the pending join requests of the CALLER'S business, for
// the team screen next to the invite code. Business comes from the stored
// caller row, never the body. Needs a business admin role AND the granular
// Configuracion:manage_team key (same key as the team tab).
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;
    const caller = (await sr.entities.User.filter({ id: user.id }))[0];
    if (!caller?.business_id) return Response.json({ error: 'Forbidden: no business_id' }, { status: 403 });
    if (!isBusinessAdminRole(caller.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!(await hasPermission(sr, caller, 'Configuracion', 'manage_team'))) {
      return Response.json({ error: 'Forbidden: missing permission', permission: 'Configuracion:manage_team' }, { status: 403 });
    }

    const rows = await sr.entities.JoinRequest.filter(
      { business_id: caller.business_id, status: 'pending' },
      '-created_date',
      100,
    );
    return Response.json({
      success: true,
      requests: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        user_email: r.user_email ?? null,
        user_name: r.user_name ?? null,
        created_date: r.created_date ?? null,
      })),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
