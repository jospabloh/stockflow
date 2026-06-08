import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * dailyStockReconcile — auditoría nocturna de inventario (SOLO LECTURA).
 *
 * Red de seguridad del modelo "aplicar exactamente-una-vez":
 * detecta movimientos recientes cuyo efecto sobre el stock NO se aplicó
 * (stock_applied != true), que indicarían un fallo de la aplicación síncrona.
 *
 * Es de solo lectura a propósito: NO corrige en silencio para no arriesgar
 * doble aplicación sobre movimientos históricos (anteriores a esta función, que
 * ya fueron aplicados por la automatización antigua y tienen stock_applied=false
 * por defecto). Las correcciones se hacen revisadas vía applyInventoryAuditCorrection.
 *
 * Programación sugerida: 1×/día. Autorización: CRON_SECRET.
 */
const LOOKBACK_DAYS = 2;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const cronSecretEnv = Deno.env.get('CRON_SECRET');
    const validCron = cronSecretEnv && (
      req.headers.get('x-cron-secret') === cronSecretEnv ||
      body?.['x-cron-secret'] === cronSecretEnv
    );
    if (!validCron) {
      // Permitir también a un admin autenticado para diagnóstico manual.
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Movimientos recientes sin aplicar (anomalías candidatas).
    const recent = await base44.asServiceRole.entities.Movement.filter(
      { created_date: { $gte: cutoff } },
      '-created_date',
      1000,
    );

    const anomalies = (recent || []).filter((m) => m.stock_applied !== true && m.product_id);

    const byBusiness: Record<string, number> = {};
    for (const m of anomalies) {
      const b = m.business_id || 'unknown';
      byBusiness[b] = (byBusiness[b] || 0) + 1;
    }

    const report = {
      checked_since: cutoff,
      movements_checked: recent?.length || 0,
      unapplied_count: anomalies.length,
      unapplied_by_business: byBusiness,
      unapplied_ids: anomalies.slice(0, 100).map((m) => m.id),
    };

    if (anomalies.length > 0) {
      console.log(`[STOCK-RECONCILE] ⚠️ ${anomalies.length} movimiento(s) reciente(s) sin aplicar: ${JSON.stringify(byBusiness)}`);
    } else {
      console.log('[STOCK-RECONCILE] ✅ Sin anomalías de aplicación de stock en la ventana revisada.');
    }

    return Response.json({ success: true, report });
  } catch (error) {
    console.log(`[STOCK-RECONCILE] ERROR: ${(error as Error).message}`);
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
});
