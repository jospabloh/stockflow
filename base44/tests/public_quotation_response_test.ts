/**
 * Regression: the router (quotations/entry.ts) uses body.action as the handler name,
 * so respondToPublicQuotation must read the customer's answer from a different field
 * (`response`). Before the fix it read body.action, which made it unreachable.
 *
 * Run with: deno test -A base44/tests/public_quotation_response_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getPublicResponse } from "../functions/quotations/handlers/_publicResponse.ts";

Deno.test("payload the public page sends (action = router name, response = answer) is accepted", () => {
  assertEquals(getPublicResponse({ action: "respondToPublicQuotation", token: "x", response: "accepted" }), "accepted");
  assertEquals(getPublicResponse({ action: "respondToPublicQuotation", token: "x", response: "rejected" }), "rejected");
});

Deno.test("missing or invalid response is rejected", () => {
  assertEquals(getPublicResponse({ action: "respondToPublicQuotation", token: "x" }), null);
  assertEquals(getPublicResponse({ action: "respondToPublicQuotation", token: "x", response: "foo" }), null);
  // old (broken) contract: the answer in `action` is the router name, not a response
  assertEquals(getPublicResponse({ action: "accepted", token: "x" }), null);
});

Deno.test("PublicQuotation.jsx sends the answer as `response`, not a second `action`", async () => {
  const src = await Deno.readTextFile(new URL("../../src/pages/PublicQuotation.jsx", import.meta.url));
  const line = src.split("\n").find((l) => l.includes("'respondToPublicQuotation'"))!;
  assertEquals(/token,\s*response\b/.test(line), true);
  assertEquals((line.match(/\baction\b/g) ?? []).length, 1);
});
