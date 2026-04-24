/**
 * Field Visibility Configuration
 * Define which fields/information are visible to each role
 * Sensitive fields: costos, ganancias, márgenes, IVA, precios de compra
 */

export const FIELD_VISIBILITY = {
  // Dashboard
  Dashboard: {
    admin: {
      stats: ['total_sales', 'total_revenue', 'net_profit', 'actual_profit', 'profit_margin', 'total_costs'],
      charts: ['sales_trend', 'profit_trend', 'cost_breakdown', 'margin_analysis'],
      alerts: ['low_stock', 'unpaid_invoices', 'high_costs', 'low_margins'],
    },
    almacenista: {
      stats: ['total_sales', 'total_revenue'], // Solo ingresos, no ganancias
      charts: ['sales_trend'], // Solo tendencia de ventas
      alerts: ['low_stock'], // Solo stock bajo
    },
    vendedor: {
      stats: ['total_sales', 'total_revenue'],
      charts: ['sales_trend'],
      alerts: [],
    },
  },

  // Products
  Products: {
    admin: {
      price_fields: ['purchase_price', 'retail_sale_price', 'wholesale_sale_price', 'margin', 'markup'],
      cost_info: ['cost_breakdown', 'inventory_value', 'cost_per_unit'],
      stock_fields: ['stock', 'min_stock', 'reorder_point'],
    },
    almacenista: {
      price_fields: ['retail_sale_price', 'wholesale_sale_price'], // No ve precio de compra
      cost_info: [], // No ve costos
      stock_fields: ['stock', 'min_stock', 'reorder_point'],
    },
    vendedor: {
      price_fields: ['retail_sale_price', 'wholesale_sale_price'],
      cost_info: [],
      stock_fields: ['stock'],
    },
  },

  // Quotations
  Quotations: {
    admin: {
      pricing: ['unit_price', 'cost_price', 'margin', 'total', 'subtotal', 'tax', 'final_total'],
      financial: ['total_cost', 'total_margin', 'profit_margin_percent'],
      details: ['all'],
    },
    almacenista: {
      pricing: ['unit_price', 'total', 'subtotal', 'tax', 'final_total'], // No ve costo unitario ni margen
      financial: [], // No ve información financiera
      details: ['client', 'items', 'status', 'validity'],
    },
    vendedor: {
      pricing: ['unit_price', 'total', 'subtotal', 'tax', 'final_total'],
      financial: [],
      details: ['client', 'items', 'status', 'validity'],
    },
  },

  // Movements
  Movements: {
    admin: {
      pricing: ['unit_price', 'cost_price', 'total', 'margin', 'profit'],
      cost_info: ['cost_breakdown', 'inventory_impact'],
    },
    almacenista: {
      pricing: ['unit_price', 'total'], // No ve costo
      cost_info: [],
    },
    vendedor: {
      pricing: ['unit_price', 'total'],
      cost_info: [],
    },
  },

  // Reports
  Reports: {
    admin: {
      sections: ['operational', 'financial', 'predictive', 'cost_analysis', 'margin_analysis'],
      export: true,
    },
    almacenista: {
      sections: ['operational'], // Solo reportes operacionales
      export: false,
    },
    vendedor: {
      sections: ['operational'],
      export: false,
    },
  },

  // Caja Chica
  "Caja Chica": {
    admin: {
      view: ['balance', 'movements', 'categories', 'totals', 'profit_impact'],
      edit: ['all'],
    },
    almacenista: {
      view: ['balance', 'movements', 'categories'], // No ve impacto de ganancia
      edit: ['income', 'expense'], // Solo registrar movimientos
    },
  },

  // Pagos a Proveedores
  "Pagos a Proveedores": {
    admin: {
      view: ['supplier', 'amount', 'date', 'payment_method', 'reference', 'concept', 'petty_cash_impact'],
      financial: ['total_spent', 'supplier_totals', 'payment_trends'],
    },
    almacenista: {
      view: ['supplier', 'amount', 'date', 'payment_method', 'concept'], // No ve impacto de caja chica
      financial: [],
    },
  },

  // Settings
  Configuración: {
    admin: {
      edit: ['all'], // Acceso completo
    },
    almacenista: {
      edit: [], // Sin permisos de edición
    },
  },
};

/**
 * Utility hook para validar visibilidad de campos
 * @param {string} module - Nombre del módulo (ej: "Dashboard", "Products")
 * @param {string} role - Rol del usuario (admin, almacenista, vendedor)
 * @param {string} field - Campo específico a validar (ej: "purchase_price", "profit_margin")
 * @returns {boolean} - True si el campo es visible para este rol
 */
export function canViewField(module, role, field) {
  const moduleConfig = FIELD_VISIBILITY[module];
  if (!moduleConfig) return true; // Si no hay configuración, mostrar por defecto

  const roleConfig = moduleConfig[role];
  if (!roleConfig) return false;

  // Buscar el campo en todas las propiedades del rol
  for (const [key, values] of Object.entries(roleConfig)) {
    if (Array.isArray(values)) {
      if (values.includes('all') || values.includes(field)) return true;
    }
  }

  return false;
}

/**
 * Obtener campos visibles para un rol en un módulo
 */
export function getVisibleFields(module, role) {
  const moduleConfig = FIELD_VISIBILITY[module];
  if (!moduleConfig) return null;

  return moduleConfig[role] || {};
}