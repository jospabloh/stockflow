import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * DESHABILITADA: no escribe nada. Solo valida auth y admin/owner y responde 403.
 * El stock historico solo se reporta; la logica anterior queda en el historial de git.
 */

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Solo administradores pueden aplicar correcciones de auditoría' }, { status: 403 });
    }

    // DESHABILITADA por regla de JP: el stock pasado NO se modifica, solo se reporta.
    // Esta action ya no escribe nada (ni Product, ni Movement, ni InventoryAuditLog).
    // Rehabilitarla requiere un PR aparte aprobado explicitamente: recalcular expected_stock
    // en el servidor (misma logica que auditInventory) y rechazar no_movements/legacy_bug.
    return Response.json(
      { error: 'Las correcciones de auditoria estan deshabilitadas: el stock historico solo se reporta, no se modifica. Usa Movimientos -> Ajuste.', code: 'audit_correction_disabled' },
      { status: 403 },
    );
  } catch (error) {
    console.log(`[AUDIT-CORRECTION] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
