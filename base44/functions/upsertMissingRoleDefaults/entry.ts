import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Inserts default permission profiles for any role that doesn't have one yet.
 * Safe: never overwrites existing profiles.
 * Any admin of the tenant can call this (or platform admin).
 */

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

const ROLE_DEFAULTS = {
  admin: {
    Dashboard: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Products: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Movements: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Quotations: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Reports: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Settings: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    PettyCash: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    BarcodeGenerator: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Categories: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Suppliers: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Clients: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    PaymentMethods: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    SupplierPayments: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    HelpCenter: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    About: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
  },
  almacenista: {
    'Dashboard:view': true, 'Dashboard:summary': true, 'Dashboard:low_stock': true,
    'Dashboard:recent_movements': true, 'Dashboard:sales_report': true, 'Dashboard:unpaid_detail': true,
    'Dashboard:financial': false,
    'Productos:view': true, 'Productos:create': true,
    'Productos:edit_name': true, 'Productos:edit_description': true, 'Productos:edit_stock_quantity': false,
    'Productos:edit_min_stock': true, 'Productos:edit_sku': true, 'Productos:edit_barcode': true,
    'Productos:edit_unit': true, 'Productos:edit_supplier': true, 'Productos:edit_retail_price': true,
    'Productos:edit_wholesale_price': true, 'Productos:edit_cost_price': false, 'Productos:edit_tax': true,
    'Productos:delete': true, 'Productos:import': false, 'Productos:barcode': true, 'Productos:cost_price': false,
    'Categorías:view': true, 'Categorías:create': true, 'Categorías:edit_name': true,
    'Categorías:edit_description': true, 'Categorías:edit_color': true, 'Categorías:edit_wholesale_min': true,
    'Categorías:delete': true,
    'Proveedores:view': true, 'Proveedores:create': true, 'Proveedores:edit_name': true,
    'Proveedores:edit_contact': true, 'Proveedores:edit_address': true, 'Proveedores:edit_rfc': true,
    'Proveedores:edit_notes': true, 'Proveedores:delete': true,
    'Clientes:view': true, 'Clientes:create': true, 'Clientes:edit_name': true,
    'Clientes:edit_business': true, 'Clientes:edit_contact': true, 'Clientes:edit_address': true,
    'Clientes:edit_rfc': true, 'Clientes:edit_notes': true, 'Clientes:edit_status': true,
    'Clientes:edit_force_wholesale': false, 'Clientes:edit_force_purchase': false, 'Clientes:delete': true,
    'Tipo de Pago:view': true, 'Tipo de Pago:create': true, 'Tipo de Pago:edit_name': true,
    'Tipo de Pago:edit_status': true, 'Tipo de Pago:delete': true,
    'Movimientos:view': true, 'Movimientos:create': true, 'Movimientos:entry': true,
    'Movimientos:exit': true, 'Movimientos:return': true, 'Movimientos:adjustment': false,
    'Movimientos:edit_quantity': true, 'Movimientos:edit_reason': true, 'Movimientos:edit_payment': true,
    'Movimientos:confirm_payment': true, 'Movimientos:edit_status': true, 'Movimientos:delete': true,
    'Cotizaciones:view': true, 'Cotizaciones:create': true, 'Cotizaciones:edit_items': true,
    'Cotizaciones:edit_quantities': true, 'Cotizaciones:edit_prices': true, 'Cotizaciones:edit_client': true,
    'Cotizaciones:edit_notes': true, 'Cotizaciones:edit_validity': true, 'Cotizaciones:edit_payment_method': true,
    'Cotizaciones:confirm_payment': true, 'Cotizaciones:convert': true, 'Cotizaciones:cancel': true,
    'Cotizaciones:return': true, 'Cotizaciones:pricing': true, 'Cotizaciones:send': true,
    'Cotizaciones:export': true, 'Cotizaciones:delete': true,
    'Caja Chica:view': true, 'Caja Chica:view_history': true, 'Caja Chica:add_fund': false,
    'Caja Chica:expense': true, 'Caja Chica:income': true, 'Caja Chica:edit_amount': true,
    'Caja Chica:edit_description': true, 'Caja Chica:edit_category': true, 'Caja Chica:edit_date': true,
    'Caja Chica:edit_notes': true, 'Caja Chica:delete': false,
    'Pagos a Proveedores:view': false, 'Pagos a Proveedores:create': false, 'Pagos a Proveedores:edit_supplier': false,
    'Pagos a Proveedores:edit_amount': false, 'Pagos a Proveedores:edit_date': false,
    'Pagos a Proveedores:edit_payment_method': false, 'Pagos a Proveedores:edit_concept': false,
    'Pagos a Proveedores:edit_reference': false, 'Pagos a Proveedores:edit_notes': false,
    'Pagos a Proveedores:affect_petty_cash': false, 'Pagos a Proveedores:delete': false,
    'Reportes:view': false, 'Reportes:operational': false, 'Reportes:supplier': false,
    'Reportes:predictive': false, 'Reportes:cost_view': false, 'Reportes:profit_margin': false, 'Reportes:export': false,
    'Configuración:view': false, 'Configuración:edit_company_name': false, 'Configuración:edit_company_rfc': false,
    'Configuración:edit_company_contact': false, 'Configuración:edit_logo': false, 'Configuración:edit_colors': false,
    'Configuración:edit_tax_rate': false, 'Configuración:edit_currency': false,
    'Configuración:edit_quotation_footer': false, 'Configuración:import_products': false,
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Allow tenant admin or platform owner
    if (user.role !== 'admin' && user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Allow platform admin to specify a target business_id
    const business_id = (user.email === PLATFORM_OWNER_EMAIL && body.business_id)
      ? body.business_id
      : user.business_id;

    if (!business_id) return Response.json({ error: 'No business_id found' }, { status: 400 });

    // Get existing profiles for this tenant
    const existing = await base44.asServiceRole.entities.PermissionProfile.filter({ business_id });
    const existingRoles = new Set(existing.map((p) => p.role_key));

    const created = [];
    const skipped = [];

    for (const [role_key, permissions] of Object.entries(ROLE_DEFAULTS)) {
      if (existingRoles.has(role_key)) {
        skipped.push(role_key);
        continue;
      }
      await base44.asServiceRole.entities.PermissionProfile.create({
        business_id,
        role_key,
        permissions,
      });
      created.push(role_key);
    }

    return Response.json({ success: true, business_id, created, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});