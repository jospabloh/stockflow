export const ARTIFACTS = [
  { key: 'Dashboard', label: 'Dashboard', navItemName: 'Dashboard' },
  { key: 'Products', label: 'Productos', navItemName: 'Productos' },
  { key: 'Movements', label: 'Movimientos', navItemName: 'Movimientos' },
  { key: 'Quotations', label: 'Cotizaciones', navItemName: 'Cotizaciones' },
  { key: 'Reports', label: 'Reportes', navItemName: 'Reportes' },
  { key: 'Settings', label: 'Configuración', navItemName: 'Configuración' },
  { key: 'PettyCash', label: 'Caja Chica', navItemName: 'Caja Chica' },
  { key: 'BarcodeGenerator', label: 'Generador de Códigos', navItemName: 'Generador de Códigos' },
  { key: 'Categories', label: 'Categorías', navItemName: 'Categorías' },
  { key: 'Suppliers', label: 'Proveedores', navItemName: 'Proveedores' },
  { key: 'Clients', label: 'Clientes', navItemName: 'Clientes' },
  { key: 'PaymentMethods', label: 'Tipos de Pago', navItemName: 'Tipo de pago' },
  { key: 'SupplierPayments', label: 'Pagos a Proveedores', navItemName: 'Pagos a Proveedores' },
  { key: 'HelpCenter', label: 'Centro de Ayuda', navItemName: 'Centro de Ayuda' },
  { key: 'About', label: 'Acerca de', navItemName: 'Acerca de' },
];

export const ACTIONS = ['ver', 'leer', 'escribir', 'modificar', 'eliminar'];

// LEGACY_DEFAULTS usa los mismos nombres de módulo que permissionRegistry.js
// para que el fallback en PermissionContext funcione correctamente.
export const LEGACY_DEFAULTS = {
  admin: {
    // Todos los módulos con acceso completo para admin
    Dashboard: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, create: true, edit_name: true, delete: true },
    Productos: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, create: true, edit_name: true, edit_description: true, edit_stock_quantity: true, edit_min_stock: true, edit_sku: true, edit_barcode: true, edit_unit: true, edit_supplier: true, edit_retail_price: true, edit_wholesale_price: true, edit_cost_price: true, edit_tax: true, delete: true, import: true, barcode: true, cost_price: true },
    Movimientos: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, create: true, entry: true, exit: true, return: true, adjustment: true, edit_quantity: true, edit_reason: true, edit_payment: true, confirm_payment: true, edit_status: true, delete: true },
    Cotizaciones: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, create: true, edit_items: true, edit_quantities: true, edit_prices: true, edit_client: true, edit_notes: true, edit_validity: true, edit_payment_method: true, confirm_payment: true, convert: true, cancel: true, return: true, send: true, export: true, delete: true, share: true, pricing: true },
    Reportes: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, operational: true, supplier: true, predictive: true, cost_view: true, profit_margin: true, export: true },
    Configuración: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, edit_company_name: true, edit_company_rfc: true, edit_company_contact: true, edit_logo: true, edit_colors: true, edit_tax_rate: true, edit_currency: true, edit_quotation_footer: true, import_products: true, manage_team: true, manage_referral: true, delete_account: true },
    'Caja Chica': { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, view_history: true, add_fund: true, expense: true, income: true, edit_amount: true, edit_description: true, edit_category: true, edit_date: true, edit_notes: true, delete: true },
    BarcodeGenerator: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, create: true },
    Categorías: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, create: true, edit_name: true, edit_description: true, edit_color: true, edit_wholesale_min: true, delete: true },
    Proveedores: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, create: true, edit_name: true, edit_contact: true, edit_address: true, edit_rfc: true, edit_notes: true, delete: true },
    Clientes: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, create: true, edit_name: true, edit_business: true, edit_contact: true, edit_address: true, edit_rfc: true, edit_notes: true, edit_status: true, edit_force_wholesale: true, edit_force_purchase: true, delete: true },
    'Tipo de Pago': { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, create: true, edit_name: true, edit_status: true, delete: true },
    'Pagos a Proveedores': { ver: true, leer: true, escribir: true, modificar: true, eliminar: true, view: true, create: true, edit_supplier: true, edit_amount: true, edit_date: true, edit_payment_method: true, edit_concept: true, edit_reference: true, edit_notes: true, affect_petty_cash: true, delete: true },
    'Centro de Ayuda': { ver: true, leer: true, view: true },
    'Acerca de': { ver: true, leer: true, view: true },
    CuentasFondo: { ver: true, leer: true, view: true, create: true, edit: true, delete: true },
  },
  almacenista: {
    Dashboard: { ver: true, leer: true, view: true, summary: true, period_filter: true, stat_products: true, stat_movements: true, stat_low_stock: true, movements_chart: true, low_stock: true, recent_movements: true, unpaid_alert: true },
    Productos: { ver: true, leer: true, view: true, edit_name: false, edit_description: false, edit_stock_quantity: false, edit_min_stock: false, edit_sku: false, edit_barcode: false, edit_unit: false, edit_supplier: false, edit_retail_price: false, edit_wholesale_price: false, edit_cost_price: false, edit_tax: false, delete: false, import: false, barcode: true, cost_price: false, create: false, escribir: false, modificar: false, eliminar: false },
    Movimientos: { ver: true, leer: true, escribir: true, view: true, create: true, entry: true, exit: true, return: true, adjustment: false, edit_quantity: false, edit_reason: false, edit_payment: false, confirm_payment: true, edit_status: true, delete: false, modificar: false, eliminar: false },
    Cotizaciones: { ver: true, leer: true, escribir: true, modificar: true, view: true, create: true, edit_items: true, edit_quantities: true, edit_prices: false, edit_client: true, edit_notes: true, edit_validity: true, edit_payment_method: true, confirm_payment: true, convert: true, cancel: false, return: false, send: true, export: true, delete: false, share: false, pricing: false, eliminar: false },
    Reportes: { ver: true, leer: true, view: false, operational: false, supplier: false, predictive: false, cost_view: false, profit_margin: false, export: false },
    Configuración: { ver: true, view: false, leer: false, escribir: false, modificar: false, eliminar: false, manage_referral: false },
    'Caja Chica': { ver: true, leer: true, view: true, view_history: true, add_fund: false, expense: true, income: true, edit_amount: false, edit_description: true, edit_category: true, edit_date: false, edit_notes: true, delete: false, escribir: false, modificar: false, eliminar: false },
    BarcodeGenerator: { ver: true, leer: true, escribir: true, view: true, create: true },
    Categorías: { ver: true, leer: true, view: true, create: false, edit_name: false, edit_description: false, edit_color: false, edit_wholesale_min: false, delete: true, escribir: false, modificar: false, eliminar: true },
    Proveedores: { ver: true, leer: true, view: true, create: false, edit_name: false, edit_contact: false, edit_address: false, edit_rfc: false, edit_notes: false, delete: false, escribir: false, modificar: false, eliminar: false },
    Clientes: { ver: true, leer: true, escribir: true, modificar: true, view: true, create: true, edit_name: true, edit_business: true, edit_contact: true, edit_address: true, edit_rfc: false, edit_notes: true, edit_status: true, edit_force_wholesale: false, edit_force_purchase: false, delete: false, eliminar: false },
    'Tipo de Pago': { ver: true, leer: true, view: true, create: false, edit_name: false, edit_status: false, delete: false, escribir: false, modificar: false, eliminar: false },
    'Pagos a Proveedores': { ver: false, leer: false, view: false, create: false, edit_supplier: false, edit_amount: false, edit_date: false, edit_payment_method: false, edit_concept: false, edit_reference: false, edit_notes: false, affect_petty_cash: false, delete: false, escribir: false, modificar: false, eliminar: false },
    'Centro de Ayuda': { ver: true, leer: true, view: true },
    'Acerca de': { ver: true, leer: true, view: true },
    CuentasFondo: { ver: true, leer: true, view: true, create: false, edit: false, delete: false },
  },
};