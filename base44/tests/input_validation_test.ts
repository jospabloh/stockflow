/**
 * Regression: minor input validation in Quotation / PettyCash Safe functions.
 * Before the fix: missing client_name and non-numeric amount produced 500,
 * negative totals/items were accepted and invoice_status accepted any string.
 * Run with: deno test base44/tests/input_validation_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  validateQuotationCreate,
  validateQuotationUpdates,
  validateInvoiceStatus,
} from "../functions/quotations/handlers/_validation.ts";
import { validatePettyCashAmount } from "../functions/pettyCash/handlers/_validation.ts";

const ok = { client_name: "ACME", items: [{ quantity: 1, unit_price: 10, total: 10 }], subtotal: 10, tax: 1.6, total: 11.6 };

Deno.test("create quotation: valid payload passes", () => {
  assertEquals(validateQuotationCreate(ok), null);
});
Deno.test("create quotation: missing client_name -> error (400, not 500)", () => {
  assertEquals(typeof validateQuotationCreate({ ...ok, client_name: undefined }), "string");
  assertEquals(typeof validateQuotationCreate({ ...ok, client_name: "  " }), "string");
});
Deno.test("create quotation: items must be an array", () => {
  assertEquals(typeof validateQuotationCreate({ ...ok, items: undefined }), "string");
  assertEquals(typeof validateQuotationCreate({ ...ok, items: "x" }), "string");
});
Deno.test("create quotation: negative total/subtotal/tax rejected", () => {
  assertEquals(typeof validateQuotationCreate({ ...ok, total: -5 }), "string");
  assertEquals(typeof validateQuotationCreate({ ...ok, subtotal: -1 }), "string");
  assertEquals(typeof validateQuotationCreate({ ...ok, tax: -1 }), "string");
});
Deno.test("create quotation: negative item quantity/price/total rejected", () => {
  assertEquals(typeof validateQuotationCreate({ ...ok, items: [{ quantity: -1, unit_price: 10 }] }), "string");
  assertEquals(typeof validateQuotationCreate({ ...ok, items: [{ quantity: 1, unit_price: -10 }] }), "string");
  assertEquals(typeof validateQuotationCreate({ ...ok, items: [{ quantity: 1, total: -10 }] }), "string");
});
Deno.test("create quotation: invalid invoice_status rejected", () => {
  assertEquals(typeof validateQuotationCreate({ ...ok, invoice_status: "bogus" }), "string");
  assertEquals(validateQuotationCreate({ ...ok, invoice_status: "pendiente" }), null);
});
Deno.test("update quotation: only validates provided fields", () => {
  assertEquals(validateQuotationUpdates({ notes: "x" }), null);
  assertEquals(typeof validateQuotationUpdates({ total: -1 }), "string");
  assertEquals(typeof validateQuotationUpdates({ items: [{ quantity: -2 }] }), "string");
  assertEquals(typeof validateQuotationUpdates({ items: "nope" }), "string");
  assertEquals(typeof validateQuotationUpdates({ client_name: "" }), "string");
  assertEquals(typeof validateQuotationUpdates({ invoice_status: "bogus" }), "string");
});
Deno.test("invoice_status enum", () => {
  for (const v of ["pendiente", "emitida", "no_requerida", "na"]) assertEquals(validateInvoiceStatus(v), null);
  assertEquals(typeof validateInvoiceStatus("bogus"), "string");
});
Deno.test("petty cash amount: non-numeric / non-positive rejected", () => {
  assertEquals(typeof validatePettyCashAmount("abc"), "string");
  assertEquals(typeof validatePettyCashAmount(0), "string");
  assertEquals(typeof validatePettyCashAmount(-3), "string");
  assertEquals(typeof validatePettyCashAmount(NaN), "string");
  assertEquals(typeof validatePettyCashAmount(undefined), "string");
  assertEquals(validatePettyCashAmount(25.5), null);
});
