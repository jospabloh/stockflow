/**
 * createMovementSafe must validate type / quantity / stock server-side.
 * Previously type:'bogus' was accepted (and skipped the per-type permission
 * check), quantity <= 0 / NaN was accepted (a negative exit increased stock),
 * and an exit larger than stock was accepted and clamped to 0.
 *
 * Run with: deno test base44/tests/create_movement_validation_test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateMovementInput } from "../functions/movements/handlers/_validation.ts";

Deno.test("rejects unknown movement type", () => {
  assertEquals(validateMovementInput({ type: "bogus", quantity: 1 }, 10)?.status, 400);
  assertEquals(validateMovementInput({ type: undefined, quantity: 1 }, 10)?.status, 400);
});

Deno.test("rejects non-positive / non-numeric quantity", () => {
  for (const q of [-5, 0, NaN, Infinity, "3", null, undefined]) {
    assertEquals(validateMovementInput({ type: "exit", quantity: q }, 10)?.status, 400, `quantity=${String(q)}`);
  }
});

Deno.test("rejects exit/return larger than available stock", () => {
  assertEquals(validateMovementInput({ type: "exit", quantity: 62 }, 12)?.status, 409);
  assertEquals(validateMovementInput({ type: "return", quantity: 13 }, 12)?.status, 409);
});

Deno.test("accepts valid movements", () => {
  assertEquals(validateMovementInput({ type: "exit", quantity: 12 }, 12), null);
  assertEquals(validateMovementInput({ type: "entry", quantity: 500 }, 12), null);
  assertEquals(validateMovementInput({ type: "adjustment", quantity: 3 }, 12), null);
  assertEquals(validateMovementInput({ type: "exit", quantity: 2.5 }, 3), null);
  // no product (stock unknown): stock check skipped
  assertEquals(validateMovementInput({ type: "exit", quantity: 99 }, null), null);
});
