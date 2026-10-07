// The "Reglas por negocio" page only lists rules from TENANT_RULE_CATALOG; each
// one must be a key the server accepts, or its toggle fails with
// "rule_key is not supported" the first time someone flips it.
import { TENANT_RULE_CATALOG } from '../../src/lib/tenantRuleCatalog.js';

const upsertSrc = await Deno.readTextFile(
  new URL('../functions/tenantRules/handlers/adminUpsertTenantRule.ts', import.meta.url),
);
const known = [...(upsertSrc.match(/KNOWN_RULE_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]/)?.[1] ?? '')
  .matchAll(/'([^']+)'/g)].map((m) => m[1]);

Deno.test('every catalog rule is a key adminUpsertTenantRule accepts', () => {
  if (known.length < 2) throw new Error(`parse sanity: ${known.length} server keys`);
  const unknown = TENANT_RULE_CATALOG.map((r) => r.key).filter((k) => !known.includes(k));
  if (unknown.length) throw new Error(`not accepted by the server: ${unknown.join(', ')}`);
});

Deno.test('every catalog rule explains itself: title, description and what it affects', () => {
  for (const r of TENANT_RULE_CATALOG) {
    if (!r.title || !r.description || !Array.isArray(r.affects) || r.affects.length === 0) {
      throw new Error(`incomplete catalog entry: ${r.key}`);
    }
  }
});
