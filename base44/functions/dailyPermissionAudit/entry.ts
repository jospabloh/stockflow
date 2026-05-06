import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

const CANONICAL_KEYS = [
  "Dashboard:view","Dashboard:summary","Dashboard:period_filter","Dashboard:stat_products",
  "Dashboard:stat_total_value","Dashboard:stat_movements","Dashboard:stat_low_stock",
  "Dashboard:unpaid_alert","Dashboard:overdue_alert","Dashboard:quotation_semaphore",
  "Dashboard:sales_breakdown","Dashboard:sales_cost","Dashboard:sales_actual_profit",
  "Dashboard:sales_net_profit","Dashboard:movements_chart","Dashboard:low_stock",
  "Dashboard:pending_balance","Dashboard:recent_movements","Dashboard:supplier_payments_section",
  "Dashboard:sales_report","Dashboard:unpaid_detail","Dashboard:financial",
  "Productos:view","Productos:create","Productos:edit_name","Productos:edit_description",
  "Productos:edit_stock_quantity","Productos:edit_min_stock","Productos:edit_sku",
  "Productos:edit_barcode","Productos:edit_unit","Productos:edit_supplier",
  "Productos:edit_retail_price","Productos:edit_wholesale_price","Productos:edit_cost_price",
  "Productos:edit_tax","Productos:delete","Productos:import","Productos:barcode","Productos:cost_price",
  "Categorías:view","Categorías:create","Categorías:edit_name","Categorías:edit_description",
  "Categorías:edit_color","Categorías:edit_wholesale_min","Categorías:delete",
  "Proveedores:view","Proveedores:create","Proveedores:edit_name","Proveedores:edit_contact",
  "Proveedores:edit_address","Proveedores:edit_rfc","Proveedores:edit_notes","Proveedores:delete",
  "Clientes:view","Clientes:create","Clientes:edit_name","Clientes:edit_business",
  "Clientes:edit_contact","Clientes:edit_address","Clientes:edit_rfc","Clientes:edit_notes",
  "Clientes:edit_status","Clientes:edit_force_wholesale","Clientes:edit_force_purchase","Clientes:delete",
  "Tipo de Pago:view","Tipo de Pago:create","Tipo de Pago:edit_name","Tipo de Pago:edit_status","Tipo de Pago:delete",
  "Movimientos:view","Movimientos:create","Movimientos:entry","Movimientos:exit","Movimientos:return",
  "Movimientos:adjustment","Movimientos:edit_quantity","Movimientos:edit_reason","Movimientos:edit_payment",
  "Movimientos:confirm_payment","Movimientos:edit_status","Movimientos:delete",
  "Cotizaciones:view","Cotizaciones:create","Cotizaciones:edit_items","Cotizaciones:edit_quantities",
  "Cotizaciones:edit_prices","Cotizaciones:edit_client","Cotizaciones:edit_notes","Cotizaciones:edit_validity",
  "Cotizaciones:edit_payment_method","Cotizaciones:confirm_payment","Cotizaciones:convert",
  "Cotizaciones:cancel","Cotizaciones:return","Cotizaciones:send","Cotizaciones:export",
  "Cotizaciones:delete","Cotizaciones:pricing",
  "Caja Chica:view","Caja Chica:view_history","Caja Chica:add_fund","Caja Chica:expense",
  "Caja Chica:income","Caja Chica:edit_amount","Caja Chica:edit_description","Caja Chica:edit_category",
  "Caja Chica:edit_date","Caja Chica:edit_notes","Caja Chica:delete",
  "Pagos a Proveedores:view","Pagos a Proveedores:create","Pagos a Proveedores:edit_supplier",
  "Pagos a Proveedores:edit_amount","Pagos a Proveedores:edit_date","Pagos a Proveedores:edit_payment_method",
  "Pagos a Proveedores:edit_concept","Pagos a Proveedores:edit_reference","Pagos a Proveedores:edit_notes",
  "Pagos a Proveedores:affect_petty_cash","Pagos a Proveedores:delete",
  "Reportes:view","Reportes:operational","Reportes:supplier","Reportes:predictive",
  "Reportes:cost_view","Reportes:profit_margin","Reportes:export",
  "Configuración:view","Configuración:edit_company_name","Configuración:edit_company_rfc",
  "Configuración:edit_company_contact","Configuración:edit_logo","Configuración:edit_colors",
  "Configuración:edit_tax_rate","Configuración:edit_currency","Configuración:edit_quotation_footer",
  "Configuración:import_products","Configuración:manage_team","Configuración:delete_account",
];

const ALMACENISTA_DENIED = new Set([
  "Dashboard:stat_total_value","Dashboard:supplier_payments_section","Dashboard:financial",
  "Dashboard:sales_cost","Dashboard:sales_actual_profit","Dashboard:sales_net_profit",
  "Dashboard:unpaid_detail",
  "Productos:edit_cost_price","Productos:cost_price","Productos:import","Productos:edit_stock_quantity",
  "Clientes:edit_force_wholesale","Clientes:edit_force_purchase",
  "Caja Chica:add_fund","Caja Chica:delete",
  "Movimientos:adjustment",
  "Cotizaciones:pricing",
  "Pagos a Proveedores:view","Pagos a Proveedores:create","Pagos a Proveedores:edit_supplier",
  "Pagos a Proveedores:edit_amount","Pagos a Proveedores:edit_date",
  "Pagos a Proveedores:edit_payment_method","Pagos a Proveedores:edit_concept",
  "Pagos a Proveedores:edit_reference","Pagos a Proveedores:edit_notes",
  "Pagos a Proveedores:affect_petty_cash","Pagos a Proveedores:delete",
  "Reportes:view","Reportes:operational","Reportes:supplier","Reportes:predictive",
  "Reportes:cost_view","Reportes:profit_margin","Reportes:export",
  "Configuración:view","Configuración:edit_company_name","Configuración:edit_company_rfc",
  "Configuración:edit_company_contact","Configuración:edit_logo","Configuración:edit_colors",
  "Configuración:edit_tax_rate","Configuración:edit_currency","Configuración:edit_quotation_footer",
  "Configuración:import_products","Configuración:manage_team","Configuración:delete_account",
]);

function buildDefaults(role) {
  return CANONICAL_KEYS.reduce((acc, k) => {
    acc[k] = role === 'admin' ? true : !ALMACENISTA_DENIED.has(k);
    return acc;
  }, {});
}

// Merge: add new keys with defaults, never overwrite existing values
function mergePermissions(existing, defaults) {
  const merged = { ...existing };
  let addedKeys = 0;
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in merged)) {
      merged[k] = v;
      addedKeys++;
    }
  }
  return { merged, addedKeys };
}

Deno.serve(async (req) => {
  // Auth: x-cron-secret header OR authenticated platform owner
  const cronSecret = Deno.env.get('CRON_SECRET');
  const headerSecret = req.headers.get('x-cron-secret');
  const isCronCall = cronSecret && headerSecret === cronSecret;

  if (!isCronCall) {
    // Fallback: check authenticated user
    const base44Check = createClientFromRequest(req);
    const user = await base44Check.auth.me().catch(() => null);
    if (!user || user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const base44 = createClientFromRequest(req);

  // Fetch all businesses
  const businesses = await base44.asServiceRole.entities.Business.list('-created_date', 500);

  const roles = ['admin', 'almacenista'];
  const stats = {
    businessesScanned: businesses.length,
    profilesCreated: 0,
    profilesUpdated: 0,
    keysAdded: 0,
    errors: [],
  };

  // Process in batches of 25 businesses (2 roles each = 50 ops per batch)
  const BATCH_SIZE = 25;
  for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
    const batch = businesses.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (business) => {
      const business_id = business.id;
      try {
        const existing = await base44.asServiceRole.entities.PermissionProfile.filter({ business_id });
        const existingByRole = {};
        for (const p of existing) existingByRole[p.role_key] = p;

        for (const role of roles) {
          const defaults = buildDefaults(role);
          if (!existingByRole[role]) {
            // Create missing profile
            await base44.asServiceRole.entities.PermissionProfile.create({
              business_id,
              role_key: role,
              permissions: defaults,
            });
            stats.profilesCreated++;
          } else {
            // Merge: add new keys without overwriting existing
            const { merged, addedKeys } = mergePermissions(existingByRole[role].permissions || {}, defaults);
            if (addedKeys > 0) {
              await base44.asServiceRole.entities.PermissionProfile.update(
                existingByRole[role].id,
                { permissions: merged }
              );
              stats.profilesUpdated++;
              stats.keysAdded += addedKeys;
            }
          }
        }
      } catch (err) {
        stats.errors.push({ business_id, error: err.message });
      }
    }));
  }

  // Send email report to platform owner
  const reportBody = `
<h2>StockFlow — Daily Permission Audit</h2>
<p><strong>Date:</strong> ${new Date().toISOString()}</p>
<ul>
  <li>Businesses scanned: <strong>${stats.businessesScanned}</strong></li>
  <li>Profiles created: <strong>${stats.profilesCreated}</strong></li>
  <li>Profiles updated (new keys added): <strong>${stats.profilesUpdated}</strong></li>
  <li>Total new keys added: <strong>${stats.keysAdded}</strong></li>
  <li>Errors: <strong>${stats.errors.length}</strong></li>
</ul>
${stats.errors.length > 0 ? `<pre>${JSON.stringify(stats.errors, null, 2)}</pre>` : ''}
  `.trim();

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: PLATFORM_OWNER_EMAIL,
    subject: `[StockFlow] Permission Audit — ${stats.profilesCreated} created, ${stats.profilesUpdated} updated`,
    body: reportBody,
  }).catch(() => {});

  return Response.json({ success: true, ...stats });
});