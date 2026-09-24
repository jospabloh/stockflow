import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');

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
  "Clientes:edit_force_zero_price",
  "Clientes:delete",
  "Cursos:view",
  "Cursos:create",
  "Cursos:edit",
  "Cursos:delete",
  "Inscripciones:view",
  "Inscripciones:create",
  "Inscripciones:edit",
  "Inscripciones:delete",
  "Campañas:view",
  "Campañas:send",
  "Contactos:view",
  "Contactos:create",
  "Contactos:edit",
  "Contactos:delete",
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
  "Movimientos:export",
  "Cotizaciones:view",
  "Cotizaciones:create",
  "Cotizaciones:edit_items",
  "Cotizaciones:edit_quantities",
  "Cotizaciones:edit_prices",
  "Cotizaciones:edit_client",
  "Cotizaciones:edit_notes",
  "Cotizaciones:edit_validity",
  "Cotizaciones:edit_payment_method",
  "Cotizaciones:edit_invoice_status",
  "Cotizaciones:confirm_payment",
  "Cotizaciones:revert_payment",
  "Cotizaciones:convert",
  "Cotizaciones:cancel",
  "Cotizaciones:return",
  "Cotizaciones:send",
  "Cotizaciones:export",
  "Cotizaciones:delete",
  "Cotizaciones:share",
  "Cotizaciones:edit_payment_record",
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
  "Caja Chica:export",
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
  "Pagos a Proveedores:edit_invoice_status",
  "Pagos a Proveedores:delete",
  "Reportes:view",
  "Reportes:operational",
  "Reportes:supplier",
  "Reportes:predictive",
  "Reportes:cost_view",
  "Reportes:profit_margin",
  "Reportes:export",
  "Reportes:billing",
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
  "Configuracion:audit_inventory",
  "Configuracion:export_data",
  "Configuracion:delete_account",
  "Utilidad:view",
  "Utilidad:view_withdrawals",
  "Utilidad:add_withdrawal",
  "Utilidad:edit_withdrawal",
  "Utilidad:delete_withdrawal",
  "Utilidad:manage_forecast",
  "Rubros:view",
  "Rubros:create",
  "Rubros:edit",
  "Rubros:delete",
  "CuentasFondo:view",
  "CuentasFondo:create",
  "CuentasFondo:edit",
  "CuentasFondo:delete",
  "Venta de Maquinaria:view",
  "Venta de Maquinaria:create",
  "Venta de Maquinaria:edit",
  "Venta de Maquinaria:delete",
  "Venta de Maquinaria:financials",
  "Centro de Soporte:view",
  "Centro de Soporte:create",
  "Centro de Soporte:reply",
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
  "Campañas:send",
  "Movimientos:adjustment",
  "Cotizaciones:revert_payment",
  "Caja Chica:add_fund",
  "Caja Chica:delete",
  "Caja Chica:export",
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
  "Configuracion:audit_inventory",
  "Configuracion:export_data",
  "Configuracion:delete_account",
  "Utilidad:view",
  "Utilidad:view_withdrawals",
  "Utilidad:add_withdrawal",
  "Utilidad:edit_withdrawal",
  "Utilidad:delete_withdrawal",
  "Utilidad:manage_forecast",
  "CuentasFondo:create",
  "CuentasFondo:edit",
  "CuentasFondo:delete",
  "Venta de Maquinaria:delete",
  "Venta de Maquinaria:financials",
]);
// AUTOGEN:CANONICAL_KEYS:END

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

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) && user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Forbidden — solo admin o platform-owner' }, { status: 403 });
    }

    const business_id = user.business_id;
    if (!business_id && (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL)) {
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
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
