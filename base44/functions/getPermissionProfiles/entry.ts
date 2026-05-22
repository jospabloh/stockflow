import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');

// Generar defaults completos para admin (acceso total)
function getAdminDefaults() {
  const REGISTRY_MODULES = [
    'Dashboard', 'Productos', 'Movimientos', 'Cotizaciones', 'Reportes',
    'Configuración', 'Caja Chica', 'Categorías', 'Proveedores', 'Clientes',
    'Tipo de Pago', 'Pagos a Proveedores', 'Centro de Ayuda', 'Acerca de',
  ];
  const perms = {};
  // Marcar todas las acciones posibles como true para admin
  // Esto garantiza que admin siempre tenga acceso total incluso sin perfil en BD
  const ALL_ACTIONS = [
    'view', 'create', 'edit_name', 'edit_description', 'edit_stock_quantity', 'edit_min_stock',
    'edit_sku', 'edit_barcode', 'edit_unit', 'edit_supplier', 'edit_retail_price',
    'edit_wholesale_price', 'edit_cost_price', 'edit_tax', 'delete', 'import', 'barcode',
    'cost_price', 'entry', 'exit', 'return', 'adjustment', 'edit_quantity', 'edit_reason',
    'edit_payment', 'confirm_payment', 'edit_status', 'edit_items', 'edit_quantities',
    'edit_prices', 'edit_client', 'edit_notes', 'edit_validity', 'edit_payment_method',
    'convert', 'cancel', 'send', 'export', 'pricing', 'operational', 'supplier',
    'predictive', 'cost_view', 'profit_margin', 'edit_company_name', 'edit_company_rfc',
    'edit_company_contact', 'edit_logo', 'edit_colors', 'edit_tax_rate', 'edit_currency',
    'edit_quotation_footer', 'import_products', 'manage_team', 'delete_account',
    'view_history', 'add_fund', 'expense', 'income', 'edit_amount', 'edit_category', 'edit_date',
    'edit_contact', 'edit_address', 'edit_rfc', 'edit_business', 'edit_force_wholesale',
    'edit_force_purchase', 'edit_wholesale_min', 'affect_petty_cash', 'edit_concept',
    'edit_reference', 'summary', 'period_filter', 'stat_products', 'stat_total_value',
    'stat_movements', 'stat_low_stock', 'unpaid_alert', 'overdue_alert', 'quotation_semaphore',
    'sales_breakdown', 'sales_cost', 'sales_actual_profit', 'sales_net_profit',
    'movements_chart', 'low_stock', 'pending_balance', 'recent_movements',
    'supplier_payments_section', 'sales_report', 'unpaid_detail', 'financial',
  ];
  for (const mod of REGISTRY_MODULES) {
    for (const action of ALL_ACTIONS) {
      perms[`${mod}:${action}`] = true;
    }
  }
  return perms;
}

Deno.serve(async (req) => {
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
});