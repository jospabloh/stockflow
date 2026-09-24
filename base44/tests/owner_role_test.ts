// Business admins are stored as built-in role 'owner' since 2026-09-24:
// built-in 'admin' matches every entity's user_condition:{role:"admin"} RLS
// branch, which is not scoped to a business, so a business admin stored as
// 'admin' could read and write every other business (verified live). These
// pin that an 'owner' keeps full access to its OWN business's actions in every
// _permissions.ts copy — otherwise the migration would lock owners out.
import * as business from '../functions/business/handlers/_permissions.ts';
import * as catalogSettings from '../functions/catalogSettings/handlers/_permissions.ts';
import * as machinerySales from '../functions/machinerySales/handlers/_permissions.ts';
import * as movements from '../functions/movements/handlers/_permissions.ts';
import * as pettyCash from '../functions/pettyCash/handlers/_permissions.ts';
import * as products from '../functions/products/handlers/_permissions.ts';
import * as quotations from '../functions/quotations/handlers/_permissions.ts';
import * as supplierPayments from '../functions/supplierPayments/handlers/_permissions.ts';
import * as utility from '../functions/utility/handlers/_permissions.ts';

const COPIES = { business, catalogSettings, machinerySales, movements, pettyCash, products, quotations, supplierPayments, utility };

// A profile that explicitly DENIES the key: an owner must still pass, the same
// as a legacy 'admin' business admin always did.
const denyingProfiles = {
  entities: { PermissionProfile: { filter: () => Promise.resolve([{ permissions: { 'Utilidad:add_withdrawal': false } }]) } },
};

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}

for (const [name, mod] of Object.entries(COPIES)) {
  Deno.test(`${name}/_permissions: owner is allowed even where a profile denies`, async () => {
    const owner = { role: 'owner', business_id: 'b1', email: 'owner@example.com' };
    eq(await mod.hasPermission(denyingProfiles, owner, 'Utilidad', 'add_withdrawal'), true, name);
  });
  Deno.test(`${name}/_permissions: almacenista is still bound by the profile`, async () => {
    const alm = { role: 'almacenista', business_id: 'b1', email: 'alm@example.com' };
    eq(await mod.hasPermission(denyingProfiles, alm, 'Utilidad', 'add_withdrawal'), false, name);
  });
}
