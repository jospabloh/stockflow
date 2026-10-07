import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
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
    const { supplier_id } = body;

    if (!supplier_id) {
      return Response.json({ error: 'supplier_id is required' }, { status: 400 });
    }

    // Fetch record via service role (same as the sibling deletes) to validate ownership
    const records = await base44.asServiceRole.entities.Supplier.filter({ id: supplier_id });
    if (records.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const record = records[0];

    // CRITICAL: Validate business_id ownership
    if (record.business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // PERMISSION CHECK — the granular registry key is enforced here, not just the role.
    if (!(await hasPermission(base44.asServiceRole, user, 'Proveedores', 'delete'))) {
      return Response.json({ error: 'Forbidden: missing permission', permission: 'Proveedores:delete' }, { status: 403 });
    }

    // Check for products using this supplier (scoped to business)
    const products = await base44.entities.Product.filter({ supplier: supplier_id, business_id: user.business_id });
    if (products.length > 0) {
      return Response.json({
        error: `No se puede eliminar: ${products.length} producto(s) tienen este proveedor asignado.`,
        blocked_by_products: products.length
      }, { status: 409 });
    }

    // LICENSE CHECK
    const bizArr2 = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz2 = bizArr2[0];
    const billingStatus2 = biz2?.billing_status || 'active';
    if (billingStatus2 === 'view_only' || billingStatus2 === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus2 }, { status: 403 });
    }

    // AVISO AL ADMINISTRADOR (decision de JP 2026-10-05): si quien borra no es owner/admin, el
    // aviso se crea ANTES del borrado y, si no se puede crear, NO se borra (falla cerrada).
    const needsNotice = !isBusinessAdmin(user);
    let noticeId: string | null = null;
    if (needsNotice) {
      try {
        noticeId = (await createDirectoryDeleteNotice(base44.asServiceRole, { user, entityType: 'Supplier', record })).id;
      } catch (noticeError) {
        console.error(`[deleteSupplierSafe] aviso no registrado, no se borra: ${(noticeError as Error).message}`);
        return Response.json({ error: NOTICE_FAILED_MESSAGE, notice_failed: true }, { status: 503 });
      }
    }

    try {
      await base44.asServiceRole.entities.Supplier.delete(supplier_id);
    } catch (deleteError) {
      // Un rechazo no prueba que el borrado no se aplico (respuesta perdida / timeout): se
      // comprueba el registro. Sigue ahi -> se anula el aviso; ya no esta -> el borrado ocurrio
      // y el aviso (si lo hay) se conserva. Corre para todo llamador (Codex #472 P2).
      const outcome = await settleFailedDelete(base44.asServiceRole, { entityName: 'Supplier', recordId: supplier_id, noticeId });
      if (outcome === 'gone') {
        return Response.json({ success: true, supplier_id, notice_created: needsNotice, delete_confirmed_by_recheck: true });
      }
      throw deleteError;
    }

    return Response.json({ success: true, supplier_id, notice_created: needsNotice });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}