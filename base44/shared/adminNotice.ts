/**
 * Avisos al administrador (entidad AdminNotice), compartidos por los routers.
 *
 * Decision de JP (2026-10-05): un almacenista con el permiso granular puede borrar
 * proveedores, clientes y contactos, pero cada borrado deja un aviso que el owner/admin
 * ve y marca como leido. FALLA CERRADA: el aviso se crea ANTES del borrado; si no se
 * puede crear, el borrado no se hace. Asi no puede existir un borrado de no-admin sin aviso.
 *
 * Sin imports de SDK (igual que applyStock.ts) para que las pruebas lo carguen tal cual.
 */

// deno-lint-ignore no-explicit-any
type AnyRecord = Record<string, any>;

// Un admin de negocio se guarda como rol 'owner'; 'admin' es plataforma/servicio y se
// acepta tambien (misma forma inline que usan los handlers del repo).
export function isBusinessAdmin(user: AnyRecord | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'owner';
}

export const DIRECTORY_ENTITY_LABEL: Record<string, string> = {
  Supplier: 'proveedor',
  Client: 'cliente',
  Contact: 'contacto',
};

export const NOTICE_FAILED_MESSAGE =
  'No se pudo registrar el aviso para el administrador, así que el registro NO se eliminó. Intenta de nuevo en un momento.';

/**
 * Crea el aviso de un borrado hecho por un no-admin. LANZA si la plataforma falla:
 * el llamador debe tratar el fallo como "no borrar".
 */
export async function createDirectoryDeleteNotice(
  // deno-lint-ignore no-explicit-any
  asServiceRole: any,
  { user, entityType, record }: { user: AnyRecord; entityType: string; record: AnyRecord },
): Promise<{ id: string }> {
  const label = record.name ?? record.business_name ?? record.id;
  const created = await asServiceRole.entities.AdminNotice.create({
    business_id: user.business_id,
    kind: 'directory_delete',
    entity_type: entityType,
    record_id: record.id,
    record_label: label == null ? '' : String(label),
    record_snapshot: { ...record },
    performed_by_id: user.id,
    performed_by_email: user.email,
    performed_by_name: user.full_name ?? user.name ?? '',
    performed_at: new Date().toISOString(),
    status: 'unread',
  });
  // La plataforma devuelve el registro creado; sin id no se podria compensar ni
  // se puede dar por registrado el aviso.
  if (!created?.id) throw new Error('AdminNotice.create no devolvio id');
  return { id: created.id };
}

/** Compensacion cuando el borrado falla DESPUES de crear el aviso. Nunca lanza. */
// deno-lint-ignore no-explicit-any
export async function voidNoticeBestEffort(asServiceRole: any, noticeId: string): Promise<void> {
  try {
    await asServiceRole.entities.AdminNotice.delete(noticeId);
  } catch (error) {
    console.error(`[adminNotice] no se pudo compensar el aviso ${noticeId}: ${(error as Error).message}`);
  }
}
