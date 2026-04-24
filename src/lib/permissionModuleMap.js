// Mapeo de nombres de páginas (usados en layout) a módulos de la matriz de permisos
export const PAGE_TO_MODULE_MAP = {
  Dashboard: 'Dashboard',
  Products: 'Productos',
  Categories: 'Categorías',
  Suppliers: 'Proveedores',
  Clients: 'Clientes',
  PaymentMethods: 'Tipo de Pago',
  Movements: 'Movimientos',
  Quotations: 'Cotizaciones',
  PettyCash: 'Caja Chica',
  SupplierPayments: 'Pagos a Proveedores',
  Reports: 'Reportes',
  Settings: 'Configuración',
  PermissionAdmin: 'Configuración',
  LicenseAdmin: 'Configuración',
  TenantRulesAdmin: 'Configuración',
  HelpCenter: 'Centro de Ayuda',
  About: 'Acerca de',
};

// Obtener el módulo de permisos para una página
export function getPermissionModule(pageName) {
  return PAGE_TO_MODULE_MAP[pageName] || pageName;
}