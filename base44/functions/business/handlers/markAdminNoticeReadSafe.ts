import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getAuthUser } from '../../../shared/authUser.ts';
import { isBusinessAdmin } from '../../../shared/adminNotice.ts';

// markAdminNoticeReadSafe — el owner/admin acusa de recibido un aviso. Registra quien y
// cuando; es idempotente (un segundo acuse no sobrescribe al primero). Un aviso de otro
// negocio responde 404 igual que uno inexistente. Sin gate de licencia (ver listAdminNotices).
// Body: { notice_id }
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.business_id) return Response.json({ error: 'Forbidden: no business_id' }, { status: 403 });
    if (!isBusinessAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const noticeId = body?.notice_id;
    if (!noticeId) return Response.json({ error: 'notice_id is required' }, { status: 400 });

    const sr = base44.asServiceRole;
    const notice = (await sr.entities.AdminNotice.filter({ id: noticeId }))[0];
    if (!notice || notice.business_id !== user.business_id) {
      return Response.json({ error: 'Aviso no encontrado' }, { status: 404 });
    }

    if (notice.status === 'read') {
      return Response.json({ success: true, already_read: true });
    }

    await sr.entities.AdminNotice.update(notice.id, {
      status: 'read',
      read_by_id: user.id,
      read_by_email: user.email,
      read_at: new Date().toISOString(),
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
