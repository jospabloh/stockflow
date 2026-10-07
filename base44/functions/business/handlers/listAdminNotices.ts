import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getAuthUser } from '../../../shared/authUser.ts';
import { isBusinessAdmin } from '../../../shared/adminNotice.ts';

// Cuenta los avisos no leidos paginando (Base44 no ofrece un conteo). Tope de seguridad: 100 paginas.
// deno-lint-ignore no-explicit-any
async function countUnread(sr: any, businessId: string, pageSize: number): Promise<number> {
  let total = 0;
  for (let page = 0; page < 100; page++) {
    const rows = await sr.entities.AdminNotice.filter(
      { business_id: businessId, status: 'unread' },
      '-created_date',
      pageSize,
      page * pageSize,
    );
    total += rows.length;
    if (rows.length < pageSize) break;
  }
  return total;
}

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
    const PAGE = 200;
    const notices = await sr.entities.AdminNotice.filter(
      { business_id: user.business_id, ...(onlyUnread ? { status: 'unread' } : {}) },
      '-created_date',
      PAGE,
    );
    // unread_count es el total REAL, no el tamano de la pagina (Codex #472 P2): si la primera
    // pagina de no leidos viene llena se pagina hasta agotarla.
    const unreadCount = onlyUnread && notices.length < PAGE
      ? notices.length
      : await countUnread(sr, user.business_id, PAGE);

    return Response.json({ success: true, notices, unread_count: unreadCount });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
