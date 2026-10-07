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

// Configuración → Reglas lets a business's admin flip these; the server's
// allowlist (setMyTenantRule) must be exactly the catalog the screen shows.
import { TENANT_TOGGLEABLE_RULE_KEYS, isBusinessAdminRole } from '../functions/tenantRules/handlers/_tenantToggle.ts';

Deno.test('a business admin can toggle exactly the catalog rules, nothing else', () => {
  const catalog = TENANT_RULE_CATALOG.map((r) => r.key).sort();
  const server = [...TENANT_TOGGLEABLE_RULE_KEYS].sort();
  if (JSON.stringify(catalog) !== JSON.stringify(server)) {
    throw new Error(`catalog ${catalog} vs server allowlist ${server}`);
  }
});

Deno.test('only owner/admin count as the business admin (almacenista cannot toggle)', () => {
  if (!isBusinessAdminRole('owner') || !isBusinessAdminRole('admin')) throw new Error('admin roles rejected');
  for (const r of ['almacenista', 'user', undefined, null, '']) {
    if (isBusinessAdminRole(r)) throw new Error(`role ${r} accepted`);
  }
});
