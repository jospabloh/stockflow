import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

// Canonical keys (duplicated from seed; Deno cannot import from src/)
const CANONICAL_KEYS: string[] = [
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

function getCanonicalDefaults(roleKey: string): Record<string, boolean> {
  if (roleKey === 'admin') {
    return CANONICAL_KEYS.reduce((acc: Record<string, boolean>, k) => { acc[k] = true; return acc; }, {});
  }
  if (roleKey === 'almacenista') {
    return CANONICAL_KEYS.reduce((acc: Record<string, boolean>, k) => {
      acc[k] = !ALMACENISTA_DENIED.has(k);
      return acc;
    }, {});
  }
  return {};
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.email !== PLATFORM_OWNER_EMAIL && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — solo admin o platform-owner' }, { status: 403 });
    }

    const business_id = user.business_id;
    if (!business_id && user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'User has no business_id' }, { status: 400 });
    }

    const profiles = await base44.asServiceRole.entities.PermissionProfile.filter({ business_id });

    let profilesUpdated = 0;
    let totalKeysAdded = 0;

    for (const profile of profiles) {
      const defaults = getCanonicalDefaults(profile.role_key);
      if (Object.keys(defaults).length === 0) continue;

      const existing: Record<string, boolean> = (profile.permissions as Record<string, boolean>) || {};
      // Only add new keys — existing values win
      const merged = { ...defaults, ...existing };

      const keysAdded = Object.keys(defaults).filter(k => !(k in existing)).length;
      if (keysAdded === 0) continue;

      await base44.asServiceRole.entities.PermissionProfile.update(profile.id, {
        permissions: merged,
        schema_version: 2,
        updated_by: user.email || 'system',
      });

      profilesUpdated++;
      totalKeysAdded += keysAdded;
    }

    return Response.json({
      success: true,
      profilesUpdated,
      keysAdded: totalKeysAdded,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
