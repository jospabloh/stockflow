import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { hasPermission } from './_permissions.ts';
import { getAuthUser } from '../../../shared/authUser.ts';
import {
  createDirectoryDeleteNotice,
  isBusinessAdmin,
  NOTICE_FAILED_MESSAGE,
  settleFailedDelete,
} from '../../../shared/adminNotice.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { contact_id } = body;

    if (!contact_id) {
      return Response.json({ error: 'contact_id is required' }, { status: 400 });
    }

    // Fetch record via service role to avoid silent 404 from RLS
    const records = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
    if (records.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const record = records[0];

    // CRITICAL: Validate tenant ownership — prevent cross-tenant delete
    if (record.business_id !== user.business_id) {
      console.error(
        `[deleteContactSafe] CROSS-TENANT ATTEMPT: user ${user.email} (business ${user.business_id}) ` +
        `tried to delete contact ${contact_id} (business ${record.business_id})`
      );
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // PERMISSION CHECK — the granular registry key is enforced here, not just the role.
    if (!(await hasPermission(base44.asServiceRole, user, 'Contactos', 'delete'))) {
      return Response.json({ error: 'Forbidden: missing permission', permission: 'Contactos:delete' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // AVISO AL ADMINISTRADOR (decision de JP 2026-10-05): si quien borra no es owner/admin, el
    // aviso se crea ANTES del borrado y, si no se puede crear, NO se borra (falla cerrada).
    const needsNotice = !isBusinessAdmin(user);
    let noticeId: string | null = null;
    if (needsNotice) {
      try {
        noticeId = (await createDirectoryDeleteNotice(base44.asServiceRole, { user, entityType: 'Contact', record })).id;
      } catch (noticeError) {
        console.error(`[deleteContactSafe] aviso no registrado, no se borra: ${(noticeError as Error).message}`);
        return Response.json({ error: NOTICE_FAILED_MESSAGE, notice_failed: true }, { status: 503 });
      }
    }

    try {
      await base44.asServiceRole.entities.Contact.delete(contact_id);
    } catch (deleteError) {
      // Un rechazo no prueba que el borrado no se aplico (respuesta perdida / timeout): se
      // comprueba el registro. Sigue ahi -> se anula el aviso; ya no esta -> el borrado ocurrio
      // y el aviso (si lo hay) se conserva. Corre para todo llamador (Codex #472 P2).
      const outcome = await settleFailedDelete(base44.asServiceRole, { entityName: 'Contact', recordId: contact_id, noticeId });
      if (outcome === 'gone') {
        return Response.json({ success: true, contact_id, notice_created: needsNotice, delete_confirmed_by_recheck: true });
      }
      throw deleteError;
    }

    return Response.json({ success: true, contact_id, notice_created: needsNotice });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
