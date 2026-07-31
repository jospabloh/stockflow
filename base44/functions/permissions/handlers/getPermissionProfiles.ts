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
  "Utilidad:view_withdrawals",
  "Utilidad:add_withdrawal",
  "Utilidad:manage_forecast",
  "Rubros:view",
  "Rubros:create",
  "Rubros:edit",
  "Rubros:delete",
  "CuentasFondo:view",
  "CuentasFondo:create",
  "CuentasFondo:edit",
  "CuentasFondo:delete",
];
// AUTOGEN:CANONICAL_KEYS:END

// Generar defaults completos para admin (acceso total) — garantiza que admin
// siempre tenga acceso total incluso sin perfil en BD.
function getAdminDefaults() {
  const perms: Record<string, boolean> = {};
  for (const key of CANONICAL_KEYS) perms[key] = true;
  return perms;
}

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener todos los perfiles de permisos del negocio
    const allProfiles = await base44.entities.PermissionProfile.filter({
      business_id: user.business_id,
    });

    const profiles = {};
    const featureEnabled = true;

    if (allProfiles && allProfiles.length > 0) {
      allProfiles.forEach(profile => {
        profiles[profile.role_key] = profile.permissions || {};
      });
    }

    // Si no hay perfil de admin en BD, usar defaults completos
    // para garantizar que admin siempre tenga acceso total
    if (!profiles['admin'] || Object.keys(profiles['admin']).length === 0) {
      profiles['admin'] = getAdminDefaults();
    }

    return Response.json({
      success: true,
      profiles,
      featureEnabled,
      is_platform_admin: Boolean(PLATFORM_OWNER_EMAIL) && user.email === PLATFORM_OWNER_EMAIL,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}