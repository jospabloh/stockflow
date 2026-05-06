import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
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
  "Categorías:view",
  "Categorías:create",
  "Categorías:edit_name",
  "Categorías:edit_description",
  "Categorías:edit_color",
  "Categorías:edit_wholesale_min",
  "Categorías:delete",
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
  "Configuración:view",
  "Configuración:edit_company_name",
  "Configuración:edit_company_rfc",
  "Configuración:edit_company_contact",
  "Configuración:edit_logo",
  "Configuración:edit_colors",
  "Configuración:edit_tax_rate",
  "Configuración:edit_currency",
  "Configuración:edit_quotation_footer",
  "Configuración:import_products",
  "Configuración:manage_team",
  "Configuración:delete_account",
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
  "Configuración:edit_company_name",
  "Configuración:edit_company_rfc",
  "Configuración:edit_company_contact",
  "Configuración:edit_logo",
  "Configuración:edit_colors",
  "Configuración:edit_tax_rate",
  "Configuración:edit_currency",
  "Configuración:edit_quotation_footer",
  "Configuración:import_products",
  "Configuración:manage_team",
  "Configuración:delete_account",
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

interface AuditStats {
  runAt: string;
  businessesScanned: number;
  profilesCreated: number;
  profilesUpdated: number;
  keysAdded: number;
  totalCanonicalKeys: number;
  errors: string[];
}

function buildEmail(s: AuditStats): string {
  const statusColor = s.errors.length === 0 ? '#16a34a' : '#dc2626';
  const statusLabel = s.errors.length === 0 ? '✅ Sin errores' : `⚠️ ${s.errors.length} error(es)`;
  const errorsSection = s.errors.length > 0
    ? `<div style="margin-top:16px;padding:12px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px">
        <p style="margin:0 0 8px;font-weight:600;color:#dc2626">Errores:</p>
        <ul style="margin:0;padding-left:20px;color:#374151">
          ${s.errors.map(e => `<li style="margin-bottom:4px">${e}</li>`).join('')}
        </ul>
      </div>`
    : '';

  return `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#f4f4f5;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:${BRAND_COLOR};padding:20px 24px">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">${APP_NAME}</h1>
    <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">Auditoría Nocturna de Permisos</p>
  </div>
  <div style="padding:28px 24px">
    <h2 style="margin-top:0;color:#111827">Reporte — ${fmtDate(new Date(s.runAt))}</h2>
    <p style="color:#374151">Estado: <strong style="color:${statusColor}">${statusLabel}</strong></p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;color:#6b7280;font-size:13px">Negocios escaneados</td>
        <td style="padding:10px 12px;font-weight:600;text-align:right">${s.businessesScanned}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;color:#6b7280;font-size:13px">Perfiles creados</td>
        <td style="padding:10px 12px;font-weight:600;color:#16a34a;text-align:right">${s.profilesCreated}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;color:#6b7280;font-size:13px">Perfiles actualizados</td>
        <td style="padding:10px 12px;font-weight:600;color:#2563eb;text-align:right">${s.profilesUpdated}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;color:#6b7280;font-size:13px">Claves añadidas en total</td>
        <td style="padding:10px 12px;font-weight:600;text-align:right">${s.keysAdded}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:10px 12px;color:#6b7280;font-size:13px">Claves canónicas vigentes</td>
        <td style="padding:10px 12px;font-weight:600;text-align:right">${s.totalCanonicalKeys}</td>
      </tr>
    </table>
    ${errorsSection}
    ${s.profilesCreated === 0 && s.profilesUpdated === 0
      ? '<p style="margin-top:16px;color:#6b7280;font-size:13px">Todos los perfiles ya estaban sincronizados — no se realizaron cambios.</p>'
      : ''}
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
      authorized = user?.email === PLATFORM_OWNER_EMAIL;
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
    errors: [],
  };

  try {
    const businesses = await base44.asServiceRole.entities.Business.list();
    const ops: Op[] = [];

    for (const biz of businesses) {
      stats.businessesScanned++;
      for (const role of ROLES) {
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
          ops.push({ type: 'create', business_id: biz.id, role_key: role, permissions: defaults });
        } else {
          const existing = (profiles[0].permissions as Record<string, boolean>) ?? {};
          const missingKeys = CANONICAL_KEYS.filter(k => !(k in existing));
          if (missingKeys.length > 0) {
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
        }
      }
    }
  } catch (e) {
    stats.errors.push(`fatal: ${(e as Error).message}`);
  }

  // Send email report
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: PLATFORM_OWNER_EMAIL,
      subject: `[${APP_NAME}] Auditoría de Permisos — ${fmtDate(new Date())}`,
      body: buildEmail(stats),
      from_name: APP_NAME,
    });
  } catch (e) {
    stats.errors.push(`email: ${(e as Error).message}`);
  }

  return Response.json({ success: true, ...stats });
});
