// deleteCatalogItemSafe must refuse to delete built-in catalog records
// (is_system === true, e.g. Rubro 'Reintegro'): the UI hides the delete
// button for them, but the function itself used to delete them anyway.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isProtectedSystemRecord } from "../functions/catalogSettings/handlers/_entityConfig.ts";

Deno.test("isProtectedSystemRecord: is_system=true record is protected", () => {
  assertEquals(isProtectedSystemRecord({ id: "r1", name: "Reintegro", is_system: true }), true);
});

Deno.test("isProtectedSystemRecord: user-created records are deletable", () => {
  assertEquals(isProtectedSystemRecord({ id: "r2", is_system: false }), false);
  assertEquals(isProtectedSystemRecord({ id: "r3" }), false); // PaymentMethod has no is_system
  assertEquals(isProtectedSystemRecord(undefined), false);
});
