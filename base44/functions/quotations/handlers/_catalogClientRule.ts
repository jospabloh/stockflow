// Tenant rule: quotations may only be issued to a client registered in the
// business's Client catalog (no free-typed names). Off by default; the platform
// owner turns it on per business from TenantRulesAdmin (first: Baristop,
// 2026-10-07). No imports, so `deno test` loads it without network access.
export const CATALOG_CLIENT_RULE_KEY = 'require_catalog_client_for_quotations';

export const CATALOG_CLIENT_ERROR =
  'Selecciona un cliente del catálogo. Este negocio solo permite cotizar a clientes dados de alta en Clientes.';

type Row = Record<string, unknown>;

// Same semantics as the cash rule: only a non-archived, enabled TenantRule counts.
export function isRuleEnabled(rows: unknown): boolean {
  return Array.isArray(rows) && rows.some((r: Row) => !r.archived && r.enabled === true);
}

// The client must exist, belong to this business and not be deactivated.
export function isValidCatalogClient(client: Row | null | undefined, businessId: string): boolean {
  return Boolean(client) && client!.business_id === businessId && client!.status !== 'inactive';
}

// Same label the form shows when a client is picked.
export function catalogClientName(client: Row): string {
  return String(client.business_name || client.name || '');
}

/**
 * Returns `{ enabled: false }` when the rule is off, `{ enabled: true, client }`
 * for a valid catalog client, or `{ enabled: true, error }` otherwise.
 */
export async function checkCatalogClient(
  // deno-lint-ignore no-explicit-any
  asServiceRole: any,
  businessId: string,
  clientId: unknown,
): Promise<{ enabled: boolean; client?: Row; error?: string }> {
  const rules = await asServiceRole.entities.TenantRule.filter({
    business_id: businessId,
    rule_key: CATALOG_CLIENT_RULE_KEY,
  });
  if (!isRuleEnabled(rules)) return { enabled: false };
  if (typeof clientId !== 'string' || !clientId) return { enabled: true, error: CATALOG_CLIENT_ERROR };
  const found = await asServiceRole.entities.Client.filter({ id: clientId });
  const client = Array.isArray(found) ? found[0] : null;
  if (!isValidCatalogClient(client, businessId)) return { enabled: true, error: CATALOG_CLIENT_ERROR };
  return { enabled: true, client };
}
