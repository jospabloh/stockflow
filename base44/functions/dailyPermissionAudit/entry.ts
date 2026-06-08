import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
const APP_NAME = 'StockFlow';
const BRAND_COLOR = '#4F46E5';
const ROLES = ['admin', 'almacenista'] as const;
const BATCH_SIZE = 50;

// AUTOGEN:CANONICAL_KEYS:BEGIN — regenerado por scripts/generatePermissionManifests.mjs
const CANONICAL_KEYS: string[] = [
  "Dashboard:view",
  "Dashboard:summary",
  "Dashboard:period_filter",
  "Dashboard:stat_products",
  "Dashboard:stat_total_value",
  "Dashboard:stat_movements",
  "Dashboard:stat_low_stock",
  "Dashboard:unpaid_alert",
  "Dashboard:overdue_alert",
  "Dashboard:quotation_semaphore",
  "Dashboard:sales_breakdown",
  "Dashboard:sales_cost",
  "Dashboard:sales_actual_profit",
  "Dashboard:sales_net_profit",
  "Dashboard:movements_chart",
  "Dashboard:low_stock",
  "Dashboard:pending_balance",
  "Dashboard:recent_movements",
  "Dashboard:supplier_payments_section",
  "Dashboard:sales_report",
  "Dashboard:unpaid_detail",
  "Dashboard:financial",
  "Productos:view",
  "Productos:create",
  "Productos:edit_name",
  "Productos:edit_description",
  "Productos:edit_stock_quantity",
  "Productos:edit_min_stock",
  "Productos:edit_sku",
  "Productos:edit_barcode",
  "Productos:edit_unit",
  "Productos:edit_supplier",
  "Productos:edit_retail_price",
  "Productos:edit_wholesale_price",
  "Productos:edit_cost_price",
  "Productos:edit_tax",
  "Productos:delete",
  "Productos:import",
  "Productos:barcode",
  "Productos:cost_price",
  "Categorias:view",
  "Categorias:create",
  "Categorias:edit_name",
  "Categorias:edit_description",
  "Categorias:edit_color",
  "Categorias:edit_wholesale_min",
  "Categorias:delete",
  "Proveedores:view",
  "Proveedores:create",
  "Proveedores:edit_name",
  "Proveedores:edit_contact",
  "Proveedores:edit_address",
  "Proveedores:edit_rfc",
  "Proveedores:edit_notes",
  "Proveedores:delete",
  "Clientes:view",
  "Clientes:create",
  "Clientes:edit_name",
  "Clientes:edit_business",
  "Clientes:edit_contact",
  "Clientes:edit_address",
  "Clientes:edit_rfc",
  "Clientes:edit_notes",
  "Clientes:edit_status",
  "Clientes:edit_force_wholesale",
  "Clientes:edit_force_purchase",
  "Clientes:delete",
  "Tipo de Pago:view",
  "Tipo de Pago:create",
  "Tipo de Pago:edit_name",
  "Tipo de Pago:edit_status",
  "Tipo de Pago:delete",
  "Movimientos:view",
  "Movimientos:create",
  "Movimientos:entry",
  "Movimientos:exit",
  "Movimientos:return",
  "Movimientos:adjustment",
  "Movimientos:edit_quantity",
  "Movimientos:edit_reason",
  "Movimientos:edit_payment",
  "Movimientos:confirm_payment",
  "Movimientos:edit_status",
  "Movimientos:delete",
  "Cotizaciones:view",
  "Cotizaciones:create",
  "Cotizaciones:edit_items",
  "Cotizaciones:edit_quantities",
  "Cotizaciones:edit_prices",
  "Cotizaciones:edit_client",
  "Cotizaciones:edit_notes",
  "Cotizaciones:edit_validity",
  "Cotizaciones:edit_payment_method",
  "Cotizaciones:confirm_payment",
  "Cotizaciones:convert",
  "Cotizaciones:cancel",
  "Cotizaciones:return",
  "Cotizaciones:send",
  "Cotizaciones:export",
  "Cotizaciones:delete",
  "Cotizaciones:share",
  "Cotizaciones:pricing",
  "Caja Chica:view",
  "Caja Chica:view_history",
  "Caja Chica:add_fund",
  "Caja Chica:expense",
  "Caja Chica:income",
  "Caja Chica:edit_amount",
  "Caja Chica:edit_description",
  "Caja Chica:edit_category",
  "Caja Chica:edit_date",
  "Caja Chica:edit_notes",
  "Caja Chica:delete",
  "Pagos a Proveedores:view",
  "Pagos a Proveedores:create",
  "Pagos a Proveedores:edit_supplier",
  "Pagos a Proveedores:edit_amount",
  "Pagos a Proveedores:edit_date",
  "Pagos a Proveedores:edit_payment_method",
  "Pagos a Proveedores:edit_concept",
  "Pagos a Proveedores:edit_reference",
  "Pagos a Proveedores:edit_notes",
  "Pagos a Proveedores:affect_petty_cash",
  "Pagos a Proveedores:delete",
  "Reportes:view",
  "Reportes:operational",
  "Reportes:supplier",
  "Reportes:predictive",
  "Reportes:cost_view",
  "Reportes:profit_margin",
  "Reportes:export",
  "Configuracion:view",
  "Configuracion:edit_company_name",
  "Configuracion:edit_company_rfc",
  "Configuracion:edit_company_contact",
  "Configuracion:edit_logo",
  "Configuracion:edit_colors",
  "Configuracion:edit_tax_rate",
  "Configuracion:edit_currency",
  "Configuracion:edit_quotation_footer",
  "Configuracion:import_products",
  "Configuracion:manage_team",
  "Configuracion:manage_referral",
  "Configuracion:delete_account",
  "Utilidad:view",
  "Utilidad:add_withdrawal",
  "Utilidad:manage_forecast",
  "Rubros:view",
  "Rubros:create",
  "Rubros:edit",
  "Rubros:delete",
];

const ALMACENISTA_DENIED = new Set<string>([
  "Dashboard:stat_total_value",
  "Dashboard:sales_cost",
  "Dashboard:sales_actual_profit",
  "Dashboard:sales_net_profit",
  "Dashboard:supplier_payments_section",
  "Dashboard:unpaid_detail",
  "Dashboard:financial",
  "Productos:edit_stock_quantity",
  "Productos:edit_cost_price",
  "Productos:import",
  "Productos:cost_price",
  "Clientes:edit_force_wholesale",
  "Clientes:edit_force_purchase",
  "Movimientos:adjustment",
  "Cotizaciones:pricing",
  "Caja Chica:add_fund",
  "Caja Chica:delete",
  "Pagos a Proveedores:create",
  "Pagos a Proveedores:edit_supplier",
  "Pagos a Proveedores:edit_amount",
  "Pagos a Proveedores:edit_date",
  "Pagos a Proveedores:edit_payment_method",
  "Pagos a Proveedores:edit_concept",
  "Pagos a Proveedores:edit_reference",
  "Pagos a Proveedores:edit_notes",
  "Pagos a Proveedores:affect_petty_cash",
  "Pagos a Proveedores:delete",
  "Reportes:operational",
  "Reportes:supplier",
  "Reportes:predictive",
  "Reportes:cost_view",
  "Reportes:profit_margin",
  "Reportes:export",
  "Configuracion:edit_company_name",
  "Configuracion:edit_company_rfc",
  "Configuracion:edit_company_contact",
  "Configuracion:edit_logo",
  "Configuracion:edit_colors",
  "Configuracion:edit_tax_rate",
  "Configuracion:edit_currency",
  "Configuracion:edit_quotation_footer",
  "Configuracion:import_products",
  "Configuracion:manage_team",
  "Configuracion:delete_account",
  "Utilidad:view",
  "Utilidad:add_withdrawal",
  "Utilidad:manage_forecast",
]);
// AUTOGEN:CANONICAL_KEYS:END

function getDefaults(role: string): Record<string, boolean> {
  if (role === 'admin') {
    return CANONICAL_KEYS.reduce((acc, k) => { acc[k] = true; return acc; }, {} as Record<string, boolean>);
  }
  if (role === 'almacenista') {
    return CANONICAL_KEYS.reduce((acc, k) => {
      acc[k] = !ALMACENISTA_DENIED.has(k);
      return acc;
    }, {} as Record<string, boolean>);
  }
  return {};
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

type CheckStatus = 'ok' | 'auto' | 'human';
interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

interface AuditStats {
  runAt: string;
  businessesScanned: number;
  profilesCreated: number;
  profilesUpdated: number;
  keysAdded: number;
  totalCanonicalKeys: number;
  checks: CheckResult[];
  errors: string[];
}

function statusBadge(status: CheckStatus): string {
  if (status === 'ok') {
    return '<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">✅ OK</span>';
  }
  if (status === 'auto') {
    return '<span style="background:#dbeafe;color:#1d4ed8;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">🔧 Auto-corregido</span>';
  }
  return '<span style="background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600">⚠️ Acción humana</span>';
}

function buildEmail(s: AuditStats): string {
  const humanItems = s.checks.filter(c => c.status === 'human');
  const headerColor = humanItems.length > 0 ? '#dc2626' : '#16a34a';
  const headerLabel = humanItems.length > 0
    ? `⚠️ ${humanItems.length} acción(es) humana(s)`
    : '✅ Todo en orden';

  const rows = s.checks.map(c => `
    <tr>
      <td style="padding:10px 12px;color:#374151;font-size:13px;border-bottom:1px solid #f1f5f9">${c.name}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #f1f5f9">${statusBadge(c.status)}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0 12px 10px;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb">${c.detail}</td>
    </tr>`).join('');

  const manualSection = humanItems.length > 0
    ? `<div style="margin-top:16px;padding:12px;background:#fefce8;border-left:3px solid #ca8a04;border-radius:4px">
        <p style="margin:0 0 8px;color:#92400e;font-weight:600">Requiere acción humana:</p>
        <ul style="margin:0;padding-left:20px;color:#78350f;font-size:13px">
          ${humanItems.map(c => `<li style="margin-bottom:4px"><strong>${c.name}:</strong> ${c.detail}</li>`).join('')}
        </ul>
      </div>`
    : '';

  return `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#f4f4f5;font-family:Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:${BRAND_COLOR};padding:20px 24px">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">${APP_NAME}</h1>
    <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">Auditoría Nocturna de Permisos</p>
  </div>
  <div style="padding:28px 24px">
    <h2 style="margin-top:0;color:#111827">Reporte — ${fmtDate(new Date(s.runAt))}</h2>
    <p style="color:#374151;margin:0 0 4px">Estado: <strong style="color:${headerColor}">${headerLabel}</strong></p>
    <p style="color:#6b7280;margin:0 0 16px;font-size:13px">
      ${s.businessesScanned} negocio(s) escaneado(s) · ${s.totalCanonicalKeys} claves canónicas ·
      ${s.profilesCreated} perfil(es) creado(s) · ${s.profilesUpdated} actualizado(s) ·
      ${s.keysAdded} clave(s) añadida(s)
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:8px">
      ${rows}
    </table>
    ${manualSection}
  </div>
  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center">
    <p style="margin:0;font-size:11px;color:#9ca3af">Cron: 0 9 * * * — ${APP_NAME} Platform</p>
  </div>
</div>
</body></html>`;
}

type CreateOp = { type: 'create'; business_id: string; role_key: string; permissions: Record<string, boolean> };
type UpdateOp = { type: 'update'; id: string; permissions: Record<string, boolean>; keysAdded: number };
type Op = CreateOp | UpdateOp;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Auth: cron secret OR platform-owner session
  const cronSecret = req.headers.get('x-cron-secret');
  const validSecret = Deno.env.get('CRON_SECRET');
  let authorized = Boolean(validSecret && cronSecret === validSecret);
  if (!authorized) {
    try {
      const user = await base44.auth.me();
      authorized = Boolean(PLATFORM_OWNER_EMAIL) && user?.email === PLATFORM_OWNER_EMAIL;
    } catch { /* no valid session */ }
  }
  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats: AuditStats = {
    runAt: new Date().toISOString(),
    businessesScanned: 0,
    profilesCreated: 0,
    profilesUpdated: 0,
    keysAdded: 0,
    totalCanonicalKeys: CANONICAL_KEYS.length,
    checks: [],
    errors: [],
  };

  // Per-business diagnostics so the email can show what was auto-corrected
  // vs what still needs a human.
  let totalRequiredProfiles = 0;
  const missingProfileLabels: string[] = [];
  const incompleteProfileLabels: string[] = [];
  const failedOps: string[] = [];

  try {
    const businesses = await base44.asServiceRole.entities.Business.list();
    const ops: Op[] = [];

    for (const biz of businesses) {
      stats.businessesScanned++;
      const bizLabel = (biz as Record<string, unknown>).name ?? biz.id;
      for (const role of ROLES) {
        totalRequiredProfiles++;
        let profiles: Record<string, unknown>[];
        try {
          profiles = await base44.asServiceRole.entities.PermissionProfile.filter({
            business_id: biz.id,
            role_key: role,
          });
        } catch (e) {
          stats.errors.push(`filter ${biz.id}/${role}: ${(e as Error).message}`);
          continue;
        }

        const defaults = getDefaults(role);

        if (profiles.length === 0) {
          missingProfileLabels.push(`${bizLabel} / ${role}`);
          ops.push({ type: 'create', business_id: biz.id, role_key: role, permissions: defaults });
        } else {
          const existing = (profiles[0].permissions as Record<string, boolean>) ?? {};
          const missingKeys = CANONICAL_KEYS.filter(k => !(k in existing));
          if (missingKeys.length > 0) {
            incompleteProfileLabels.push(`${bizLabel} / ${role} (+${missingKeys.length})`);
            // Existing values win; only inject truly missing keys with their defaults
            const merged: Record<string, boolean> = {};
            for (const k of CANONICAL_KEYS) {
              merged[k] = k in existing ? existing[k] : defaults[k];
            }
            ops.push({ type: 'update', id: profiles[0].id as string, permissions: merged, keysAdded: missingKeys.length });
          }
        }
      }
    }

    // Execute in batches of BATCH_SIZE
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const batch = ops.slice(i, i + BATCH_SIZE);
      for (const op of batch) {
        try {
          if (op.type === 'create') {
            await base44.asServiceRole.entities.PermissionProfile.create({
              business_id: op.business_id,
              role_key: op.role_key,
              permissions: op.permissions,
            });
            stats.profilesCreated++;
            stats.keysAdded += Object.keys(op.permissions).length;
          } else {
            await base44.asServiceRole.entities.PermissionProfile.update(op.id, {
              permissions: op.permissions,
            });
            stats.profilesUpdated++;
            stats.keysAdded += op.keysAdded;
          }
        } catch (e) {
          const label = op.type === 'create'
            ? `create ${op.business_id}/${op.role_key}`
            : `update ${op.id}`;
          stats.errors.push(`${label}: ${(e as Error).message}`);
          failedOps.push(label);
        }
      }
    }
  } catch (e) {
    stats.errors.push(`fatal: ${(e as Error).message}`);
  }

  // ─── Build per-check report ─────────────────────────────────────────────
  const sample = (arr: string[], n = 5) =>
    arr.length <= n ? arr.join(', ') : `${arr.slice(0, n).join(', ')} (+${arr.length - n} más)`;

  // Check 1: every business × role has a PermissionProfile
  if (missingProfileLabels.length === 0) {
    stats.checks.push({
      name: 'Perfiles por negocio × rol',
      status: 'ok',
      detail: `${totalRequiredProfiles} perfil(es) requerido(s); todos existen en BD.`,
    });
  } else {
    stats.checks.push({
      name: 'Perfiles por negocio × rol',
      status: 'auto',
      detail: `${missingProfileLabels.length} perfil(es) faltante(s) creado(s) con los defaults del rol: ${sample(missingProfileLabels)}.`,
    });
  }

  // Check 2: every PermissionProfile contains the full canonical key set
  if (incompleteProfileLabels.length === 0) {
    stats.checks.push({
      name: 'Cobertura de claves canónicas',
      status: 'ok',
      detail: `${CANONICAL_KEYS.length} clave(s) canónica(s) presentes en todos los perfiles.`,
    });
  } else {
    stats.checks.push({
      name: 'Cobertura de claves canónicas',
      status: 'auto',
      detail: `${incompleteProfileLabels.length} perfil(es) con claves faltantes inyectadas (valores existentes preservados): ${sample(incompleteProfileLabels)}.`,
    });
  }

  // Check 3: write failures need human attention
  if (failedOps.length === 0 && stats.errors.length === 0) {
    stats.checks.push({
      name: 'Operaciones de escritura',
      status: 'ok',
      detail: `${stats.profilesCreated + stats.profilesUpdated} operación(es) ejecutada(s) sin errores.`,
    });
  } else if (failedOps.length > 0) {
    stats.checks.push({
      name: 'Operaciones de escritura',
      status: 'human',
      detail: `${failedOps.length} operación(es) fallaron — revisa permisos/RLS: ${sample(failedOps)}.`,
    });
  } else {
    stats.checks.push({
      name: 'Operaciones de escritura',
      status: 'human',
      detail: `Errores no-fatales durante el escaneo: ${stats.errors.slice(0, 3).join('; ')}`,
    });
  }

  // Send email report
  try {
    const humanCount = stats.checks.filter(c => c.status === 'human').length;
    const subject = humanCount > 0
      ? `[${APP_NAME}] ⚠️ Permisos: ${humanCount} acción(es) humana(s) — ${fmtDate(new Date())}`
      : `[${APP_NAME}] Auditoría de Permisos — ${fmtDate(new Date())}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: PLATFORM_OWNER_EMAIL,
      subject,
      body: buildEmail(stats),
      from_name: APP_NAME,
    });
  } catch (e) {
    stats.errors.push(`email: ${(e as Error).message}`);
  }

  return Response.json({ success: true, ...stats });
});
