// Rules a business's own admin may switch on/off for their business, from
// Configuración → Reglas. Must equal TENANT_RULE_CATALOG's keys in
// src/lib/tenantRuleCatalog.js (tenant_rule_catalog_test.ts checks it), and
// every key must also be in KNOWN_RULE_KEYS. No imports, so deno test loads it.
export const TENANT_TOGGLEABLE_RULE_KEYS = [
  'require_catalog_client_for_quotations',
  'cash_sales_to_petty_cash',
];

// Config a rule gets the first time it's created; an existing row keeps its own.
export const DEFAULT_RULE_CONFIG: Record<string, Record<string, unknown>> = {
  cash_sales_to_petty_cash: { prevent_duplicates: true },
};

// A business's admin is stored as 'owner'; legacy business admins as 'admin'.
export function isBusinessAdminRole(role: unknown): boolean {
  return role === 'owner' || role === 'admin';
}
