// adminListTenantRules.known_rule_keys must offer every rule_key that
// adminUpsertTenantRule accepts, otherwise a UI selector built from the list
// cannot offer e.g. enable_granular_permissions.
// The handlers read env/SDK at import time, so compare the declared lists from source.
const dir = new URL('../functions/tenantRules/handlers/', import.meta.url);

function keysFrom(src: string): string[] {
  const m = src.match(/KNOWN_RULE_KEYS\s*=\s*(?:new Set\()?\[([\s\S]*?)\]/);
  if (!m) throw new Error('KNOWN_RULE_KEYS not found');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

Deno.test('adminListTenantRules.known_rule_keys covers every key adminUpsertTenantRule accepts', async () => {
  const list = keysFrom(await Deno.readTextFile(new URL('adminListTenantRules.ts', dir)));
  const upsert = keysFrom(await Deno.readTextFile(new URL('adminUpsertTenantRule.ts', dir)));
  if (upsert.length < 5) throw new Error(`parse sanity: upsert keys ${upsert.length}`);
  const missing = upsert.filter((k) => !list.includes(k));
  if (missing.length) throw new Error(`known_rule_keys missing: ${missing.join(', ')}`);
  if (list.length !== upsert.length) throw new Error(`length mismatch ${list.length} vs ${upsert.length}`);
});
