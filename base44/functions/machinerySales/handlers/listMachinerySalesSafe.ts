import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

/**
 * Lectura redactada de `MachinerySale` para el propio inquilino.
 *
 * Reemplaza la llamada directa que `useMachinerySales`
 * (`src/hooks/queries/index.js`) hacía antes contra
 * `base44.entities.MachinerySale.filter(...)`: esa llamada traía `cost`
 * completo al navegador para CUALQUIER usuario con acceso a la página, y
 * `MachinerySales.jsx` sólo ocultaba la columna con un `if` — el JSON ya
 * había viajado y era recuperable desde el panel de red o el caché de React
 * Query sin ningún esfuerzo técnico especial (auditoría 2026-09-07, hallazgo
 * #3 de CLAUDE.md, "lectura confidencial sistémica").
 *
 * `sale_price` NO se redacta: sólo `cost` es 'financials' (ver
 * `permissionRegistry.js` — el vendedor necesita saber en cuánto vendió).
 * Quitar `cost` también evita que el cliente pueda derivar `profit`/
 * `commission` con la aritmética de `machinerySales.js`, que es justo lo que
 * se quiere: sin costo, no hay utilidad ni comisión que calcular.
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.business_id) {
      return Response.json({ success: true, sales: [] });
    }

    const canSeeFinancials = await hasPermission(base44.asServiceRole, user, 'Venta de Maquinaria', 'financials');

    const sales = await base44.asServiceRole.entities.MachinerySale.filter(
      { business_id: user.business_id },
      '-created_date',
      1000
    );

    const redacted = canSeeFinancials
      ? sales
      : sales.map(({ cost: _cost, ...rest }) => rest);

    return Response.json({ success: true, sales: redacted });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
