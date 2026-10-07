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

    // Base44 no ofrece actualizacion condicional (compare-and-set), asi que el "primer lector
    // gana" es la mejor aproximacion sin infraestructura nueva (Codex #472 P2):
    //  1) relectura inmediata antes de escribir: si otro admin ya acuso, no se escribe;
    //  2) escritura;
    //  3) verificacion posterior: si otro acuse llego despues y piso el nuestro pero el
    //     nuestro es anterior (read_at), se restituye al primer lector.
    // Limite: si otro admin escribe entre (1) y (2) y no vuelve a verificar, la ventana es de
    // milisegundos y el ultimo en escribir queda; un aviso siempre queda leido por un admin.
    const fresh = (await sr.entities.AdminNotice.filter({ id: notice.id }))[0];
    if (fresh?.status === 'read') {
      return Response.json({ success: true, already_read: true });
    }

    const ack = {
      status: 'read',
      read_by_id: user.id,
      read_by_email: user.email,
      read_at: new Date().toISOString(),
    };
    await sr.entities.AdminNotice.update(notice.id, ack);

    const after = (await sr.entities.AdminNotice.filter({ id: notice.id }))[0];
    if (after?.status === 'read' && after.read_by_id !== user.id) {
      const theirs = String(after.read_at ?? '');
      const oursIsFirst = ack.read_at < theirs || (ack.read_at === theirs && String(user.id) < String(after.read_by_id));
      if (!oursIsFirst) {
        // El otro es anterior: se queda el suyo.
        return Response.json({ success: true, already_read: true });
      }
      // Nosotros somos anteriores y nos pisaron: se restituye al primer lector.
      await sr.entities.AdminNotice.update(notice.id, ack);
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
