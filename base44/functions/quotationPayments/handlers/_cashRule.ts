// Regla de tenant que controla los ingresos automaticos a caja chica por ventas
// en efectivo. Misma semantica que syncCashSaleToPettyCash: solo aplica si
// existe una TenantRule no archivada y habilitada.
const CASH_RULE_KEY = 'cash_sales_to_petty_cash';

export async function isCashRuleEnabled(
  // deno-lint-ignore no-explicit-any
  asServiceRole: any,
  businessId: string,
): Promise<boolean> {
  const rows = await asServiceRole.entities.TenantRule.filter({
    business_id: businessId,
    rule_key: CASH_RULE_KEY,
  });
  return Array.isArray(rows) && rows.some((r) => !r.archived && r.enabled);
}
