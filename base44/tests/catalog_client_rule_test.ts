// Baristop (2026-10-07): "NO se pueden hacer cotizaciones si el cliente no está
// dado de alta". With the tenant rule on, a quotation needs a client from this
// business's own catalog; with it off, nothing changes for anyone else.
import {
  checkCatalogClient,
  catalogClientName,
  CATALOG_CLIENT_ERROR,
  CATALOG_CLIENT_RULE_KEY,
} from '../functions/quotations/handlers/_catalogClientRule.ts';

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}

type Row = Record<string, unknown>;
function fakeDb(rules: Row[], clients: Row[]) {
  const match = (row: Row, q: Row) => Object.entries(q).every(([k, v]) => row[k] === v);
  return {
    entities: {
      TenantRule: { filter: (q: Row) => Promise.resolve(rules.filter((r) => match(r, q))) },
      Client: { filter: (q: Row) => Promise.resolve(clients.filter((c) => match(c, q))) },
    },
  };
}

const BIZ = 'biz-baristop';
const ruleOn = { business_id: BIZ, rule_key: CATALOG_CLIENT_RULE_KEY, enabled: true };
const clients = [
  { id: 'c1', business_id: BIZ, name: 'Ana', business_name: 'Café Ana', status: 'active' },
  { id: 'c2', business_id: BIZ, name: 'Baja', status: 'inactive' },
  { id: 'c3', business_id: 'other-biz', name: 'Ajeno', status: 'active' },
];

Deno.test('rule off: free-typed client still allowed (other tenants unaffected)', async () => {
  eq((await checkCatalogClient(fakeDb([], clients), BIZ, undefined)).error, undefined, 'no rule row');
  const off = { ...ruleOn, enabled: false };
  eq((await checkCatalogClient(fakeDb([off], clients), BIZ, null)).error, undefined, 'disabled');
  const archived = { ...ruleOn, archived: true };
  eq((await checkCatalogClient(fakeDb([archived], clients), BIZ, null)).error, undefined, 'archived');
});

Deno.test('rule on: missing client_id is rejected', async () => {
  eq((await checkCatalogClient(fakeDb([ruleOn], clients), BIZ, null)).error, CATALOG_CLIENT_ERROR, 'null');
  eq((await checkCatalogClient(fakeDb([ruleOn], clients), BIZ, '')).error, CATALOG_CLIENT_ERROR, 'empty');
});

Deno.test('rule on: unknown, inactive or other-tenant clients are rejected', async () => {
  const db = fakeDb([ruleOn], clients);
  eq((await checkCatalogClient(db, BIZ, 'nope')).error, CATALOG_CLIENT_ERROR, 'unknown');
  eq((await checkCatalogClient(db, BIZ, 'c2')).error, CATALOG_CLIENT_ERROR, 'inactive');
  eq((await checkCatalogClient(db, BIZ, 'c3')).error, CATALOG_CLIENT_ERROR, 'other tenant');
});

Deno.test('rule on: catalog client passes and the stored name comes from the catalog', async () => {
  const res = await checkCatalogClient(fakeDb([ruleOn], clients), BIZ, 'c1');
  eq(res.error, undefined, 'valid');
  eq(catalogClientName(res.client!), 'Café Ana', 'name prefers business_name');
  eq(catalogClientName({ name: 'Solo nombre' }), 'Solo nombre', 'falls back to name');
});
