// Valores predeterminados de los catálogos configurables (Rubros y Cuentas).
// Se siembran una sola vez por negocio. Compartidos por las páginas de catálogo,
// el módulo Utilidad y Caja Chica para mantener una sola fuente de verdad.

// Rubros (categorías de ingreso/egreso). Lista unificada que alimenta tanto el
// módulo de Utilidad como el campo Categoría de Caja Chica.
export const DEFAULT_RUBROS = [
  // Ingresos
  { name: "Ventas", kind: "income" },
  { name: "Otros ingresos", kind: "income" },
  { name: "Reposición", kind: "income" },
  { name: "Reintegro", kind: "income" },
  { name: "Ajuste positivo", kind: "income" },
  // Egresos
  { name: "Renta", kind: "expense" },
  { name: "Nómina", kind: "expense" },
  { name: "Servicios", kind: "expense" },
  { name: "Compras de mercancía", kind: "expense" },
  { name: "Mantenimiento", kind: "expense" },
  { name: "Publicidad", kind: "expense" },
  { name: "Retiro de utilidades", kind: "expense" },
  { name: "Papelería", kind: "expense" },
  { name: "Limpieza", kind: "expense" },
  { name: "Transporte", kind: "expense" },
  { name: "Compras menores", kind: "expense" },
  { name: "Mantenimiento menor", kind: "expense" },
  { name: "Viáticos locales", kind: "expense" },
  { name: "Otros", kind: "expense" },
];

// Cuentas / fuentes de dinero.
export const DEFAULT_ACCOUNTS = [
  { name: "Efectivo (Caja Chica)", affects_petty_cash: true },
  { name: "Tarjeta AFIRME", affects_petty_cash: false },
];
