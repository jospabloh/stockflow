// Mapeo de nombres de páginas (usados en layout) a módulos de la matriz de permisos
export const PAGE_TO_MODULE_MAP = {
  Dashboard: 'Dashboard',
  Products: 'Productos',
  Categories: 'Categorias',
  Suppliers: 'Proveedores',
  Clients: 'Clientes',
  Contacts: 'Contactos',
  Courses: 'Cursos',
  CourseCalendar: 'Cursos',
  Enrollments: 'Inscripciones',
  Campaigns: 'Campañas',
  PaymentMethods: 'Tipo de Pago',
  Movements: 'Movimientos',
  Quotations: 'Cotizaciones',
  PettyCash: 'Caja Chica',
  Utility: 'Utilidad',
  Rubros: 'Rubros',
  SupplierPayments: 'Pagos a Proveedores',
  Reports: 'Reportes',
  Settings: 'Configuracion',
  PermissionAdmin: 'Configuracion',
  LicenseAdmin: 'Configuracion',
  TenantRulesAdmin: 'Configuracion',
  FundAccounts: 'CuentasFondo',
  HelpCenter: 'Centro de Ayuda',
  About: 'Acerca de',
  SupportTickets: 'Centro de Soporte',
};

// Obtener el módulo de permisos para una página
export function getPermissionModule(pageName) {
  return PAGE_TO_MODULE_MAP[pageName] || pageName;
}