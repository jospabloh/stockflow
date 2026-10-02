import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * dailyStockReconcile — auditoría diaria de inventario.
 *
 * Red de seguridad del modelo "aplicar exactamente-una-vez".
 *
 * 1) Movimientos recientes con stock_apply_state 'pending'/'failed' y
 *    stock_applied != true: NO se reintentan ni se sanan aquí (comparar valores de
 *    stock no prueba que nadie más tocó el producto: ABA). Solo se REPORTAN con
 *    alerta persistente; la recuperación segura es el reintento inmediato dentro de
 *    applyStockForMovement.
 * 2) Movimientos sin estado y con stock_applied != true (histórico/legacy, o
 *    fallo de la primera escritura): NUNCA se corrigen aquí (riesgo de doble
 *    aplicación); se REPORTAN y se deja una alerta persistente (InventoryAuditLog
 *    stock_apply_failed) una sola vez por movimiento.
 *
 * Es de SOLO LECTURA sobre Movement/Product: nunca los modifica (solo escribe alertas).
 * Programación sugerida: 1×/día. Autorización: CRON_SECRET.
 *
 * Avisos:
 *   - Si quedan anomalías (o la ventana quedó truncada) envía un correo al platform
 *     owner (PLATFORM_OWNER_EMAIL) con Core.SendEmail. Si todo está bien no envía nada.
 *   - La ventana es de 25 h (corrida diaria + 1 h de holgura) para que una anomalía
 *     salga en UN solo reporte.
 *   - Los Movement se leen paginados; si se alcanza el tope de seguridad se marca
 *     `truncated` y se avisa.
 *   - Un fallo al enviar el correo nunca hace fallar el job.
 */
const LOOKBACK_HOURS = 25;
const PAGE_SIZE = 500;
const GRACE_MS = 10 * 60 * 1000; // no tocar movimientos en curso
const MAX_PAGES = 40; // 20 000 movimientos dentro de la ventana, tope de seguridad

const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const cronSecretEnv = Deno.env.get('CRON_SECRET');
    const validCron = cronSecretEnv && (
      req.headers.get('x-cron-secret') === cronSecretEnv ||
      body?.['x-cron-secret'] === cronSecretEnv
    );
    if (!validCron) {
      // Cross-tenant read (scans Movement across every business) — manual
      // trigger for diagnostics is platform-owner only, NOT any tenant's
      // role:admin user (every self-service business owner legitimately has
      // role:admin for their own tenant, which must not extend to reading
      // other tenants' movement data).
      const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
      const user = await base44.auth.me().catch(() => null);
      if (!user || !PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

    // Movimientos más recientes primero, paginados, hasta salir de la ventana.
    // (El filtrado por fecha y por stock_applied se hace en JS por compatibilidad
    // con el SDK.) Si se agota MAX_PAGES sin salir de la ventana, está truncada.
    // deno-lint-ignore no-explicit-any
    const inWindow: any[] = [];
    let truncated = true;
    for (let page = 0; page < MAX_PAGES; page++) {
      const chunk = (await base44.asServiceRole.entities.Movement.filter(
        {},
        '-created_date',
        PAGE_SIZE,
        page * PAGE_SIZE,
      )) || [];
      for (const m of chunk) if ((m.created_date || '') >= cutoff) inWindow.push(m);
      const oldest = chunk.length ? (chunk[chunk.length - 1].created_date || '') : '';
      if (chunk.length < PAGE_SIZE || oldest < cutoff) { truncated = false; break; }
    }

    const unapplied = inWindow.filter((m) =>
      m.stock_applied !== true && m.product_id && Date.now() - Date.parse(m.created_date || '') > GRACE_MS
    );
    const retryable = unapplied.filter((m) => m.stock_apply_state === 'pending' || m.stock_apply_state === 'failed');

    // (1) NO se sana nada automáticamente: un fallo de un día anterior es un problema pasado y
    // solo se REPORTA. La recuperación inmediata ocurre dentro de applyStockForMovement (segundos).
    const healed: string[] = [];

    // (2)+(3) alertas persistentes, una vez por movimiento
    const toAlert = [
      ...unapplied.filter((m) => !retryable.includes(m)).map((m) => ({ m, why: 'sin aplicar y sin estado (no se corrige automáticamente)' })),
      ...retryable.map((m) => ({ m, why: `estado '${m.stock_apply_state}' sin confirmar${m.stock_apply_error ? ` (${String(m.stock_apply_error).slice(0, 200)})` : ''}; no se reintenta ni se corrige automáticamente, requiere revisión` })),
    ];
    let alerted = 0;
    for (const { m, why } of toAlert) {
      try {
        const tag = `[reconcile ${m.id}]`;
        const existing = await base44.asServiceRole.entities.InventoryAuditLog.filter({
          business_id: m.business_id, product_id: m.product_id, event_type: 'stock_apply_failed',
        });
        if ((existing || []).some((a: { notes?: string }) => (a.notes || '').includes(tag))) continue;
        await base44.asServiceRole.entities.InventoryAuditLog.create({
          business_id: m.business_id,
          product_id: m.product_id,
          product_name: m.product_name,
          event_type: 'stock_apply_failed',
          notes: `${tag} Movimiento ${m.type} x${m.quantity} (${m.created_date}) ${why}.`,
        });
        alerted++;
      } catch (e) {
        console.log(`[STOCK-RECONCILE] no se pudo guardar alerta de ${m.id}: ${(e as Error).message}`);
      }
    }
    const anomalies = unapplied.filter((m) => !healed.includes(m.id));

    const byBusiness: Record<string, number> = {};
    for (const m of anomalies) {
      const b = m.business_id || 'unknown';
      byBusiness[b] = (byBusiness[b] || 0) + 1;
    }

    const report = {
      checked_since: cutoff,
      movements_checked: inWindow.length,
      unapplied_count: anomalies.length,
      unapplied_by_business: byBusiness,
      unapplied_ids: anomalies.slice(0, 100).map((m) => m.id),
      healed_ids: healed,
      alerts_created: alerted,
      truncated,
      email_sent: false,
    };

    if (anomalies.length > 0) {
      console.log(`[STOCK-RECONCILE] ⚠️ ${anomalies.length} movimiento(s) reciente(s) sin aplicar: ${JSON.stringify(byBusiness)}`);
    } else {
      console.log('[STOCK-RECONCILE] ✅ Sin anomalías de aplicación de stock en la ventana revisada.');
    }
    if (truncated) console.log(`[STOCK-RECONCILE] ⚠️ ventana truncada tras ${MAX_PAGES * PAGE_SIZE} movimientos; el reporte puede estar incompleto.`);

    if (anomalies.length > 0 || truncated) {
      const ownerEmail = Deno.env.get('PLATFORM_OWNER_EMAIL');
      if (!ownerEmail) {
        console.log('[STOCK-RECONCILE] sin PLATFORM_OWNER_EMAIL: no se envía aviso.');
      } else {
        try {
          const rows = anomalies.slice(0, 100).map((m) =>
            `<tr><td>${escapeHtml(m.business_id)}</td><td>${escapeHtml(m.product_name || m.product_id)}</td><td>${escapeHtml(m.type)}</td><td>${escapeHtml(m.quantity)}</td><td>${escapeHtml(m.created_date)}</td><td>${escapeHtml(m.id)}</td></tr>`
          ).join('');
          const html =
            `<p>Revisión diaria de stock (se reintentó de forma segura lo recuperable; no se tocó ningún dato histórico). Reintentados con éxito: ${healed.length}. Ventana desde ${escapeHtml(cutoff)}.</p>` +
            `<p><b>${anomalies.length}</b> movimiento(s) con stock_applied distinto de true de ${inWindow.length} revisados.` +
            (truncated ? ' <b>La ventana quedó truncada: el reporte puede estar incompleto.</b>' : '') + '</p>' +
            (anomalies.length
              ? `<table border="1" cellpadding="4" cellspacing="0"><tr><th>business_id</th><th>producto</th><th>tipo</th><th>cantidad</th><th>fecha</th><th>movement_id</th></tr>${rows}</table>` +
                (anomalies.length > 100 ? `<p>Se muestran los primeros 100.</p>` : '')
              : '');
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: ownerEmail,
            subject: `[StockFlow] ${anomalies.length} movimiento(s) sin aplicar al stock${truncated ? ' (ventana truncada)' : ''}`,
            body: html,
            from_name: 'StockFlow',
          });
          report.email_sent = true;
        } catch (err) {
          console.log(`[STOCK-RECONCILE] no se pudo enviar el aviso: ${(err as Error).message}`);
        }
      }
    }

    return Response.json({ success: true, report });
  } catch (error) {
    console.log(`[STOCK-RECONCILE] ERROR: ${(error as Error).message}`);
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
