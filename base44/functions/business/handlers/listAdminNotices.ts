import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getAuthUser } from '../../../shared/authUser.ts';
import { isBusinessAdmin } from '../../../shared/adminNotice.ts';

// listAdminNotices — avisos de borrados hechos por un no-admin, SOLO del negocio de quien
// pregunta y SOLO para owner/admin. La entidad AdminNotice es de rol de servicio (ni el
// navegador ni un almacenista la leen), asi que todo el aislamiento esta aqui: tenant del
// usuario guardado, nunca del cuerpo. Sin gate de licencia: un negocio en view_only debe
// poder ver lo que paso.
// Body: { status?: 'unread' | 'all' }  (default 'unread')
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.business_id) return Response.json({ error: 'Forbidden: no business_id' }, { status: 403 });
    // Regla por rol, no por clave de permiso: un perfil nunca debe poder concederlo a un almacenista.
    if (!isBusinessAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body: { status?: string } = {};
    try {
      body = (await req.json()) ?? {};
    } catch {
      body = {};
    }
    const onlyUnread = body.status !== 'all';

    const sr = base44.asServiceRole;
    const notices = await sr.entities.AdminNotice.filter(
      { business_id: user.business_id, ...(onlyUnread ? { status: 'unread' } : {}) },
      '-created_date',
      200,
    );
    const unreadCount = onlyUnread
      ? notices.length
      : (await sr.entities.AdminNotice.filter({ business_id: user.business_id, status: 'unread' }, '-created_date', 200)).length;

    return Response.json({ success: true, notices, unread_count: unreadCount });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
