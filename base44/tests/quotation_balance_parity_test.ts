/**
 * El helper del frontend (src/lib/quotationBalance.js) debe dar EXACTAMENTE el mismo saldo que el
 * backend (registerQuotationPayment.getBalance): si difieren, la UI muestra un saldo que el backend
 * luego rechaza al cobrar. Se extrae el getBalance real del fuente del backend (no una copia).
 * Run: deno test --allow-read base44/tests/quotation_balance_parity_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getQuotationBalance } from "../../src/lib/quotationBalance.js";

const be = await Deno.readTextFile(new URL("../functions/quotationPayments/handlers/registerQuotationPayment.ts", import.meta.url));
const fn = (name: string) => be.match(new RegExp(`function ${name}\\(q\\) \\{[\\s\\S]*?\\n\\}`))![0];
// deno-lint-ignore no-explicit-any
const backendGetBalance: (q: any) => number = new Function(`${fn("getAmountPaid")}\n${fn("getBalance")}\nreturn getBalance;`)();

const cases = [
  { status: "sent", total: 500, amount_paid: 0, paid: false },
  { status: "sent", total: 500, amount_paid: 200, paid: false, balance: 0 },
  { status: "accepted", total: 500, amount_paid: 500, paid: true },
  { status: "accepted", total: 500, amount_paid: 600, paid: false },
  { status: "sent", total: 500, amount_paid: 100, paid: true }, // paid=true no debe ocultar saldo
  { status: "sent", total: 500, paid: true }, // sin amount_paid: se asume total
  { status: "sent", total: 500, amount_paid: 0, paid: true },
  { status: "converted", total: 500, amount_paid: 500, paid: true, balance: 0 },
  { status: "converted", total: 500, amount_paid: 200, paid: false, balance: 300 },
  { status: "converted", total: 400, amount_paid: 400, paid: true, balance: 0 },
  // venta vieja: paid=true, amount_paid=0, payments=[]
  { status: "converted", total: 500, amount_paid: 0, paid: true, balance: 0, payments: [] },
  { status: "converted", total: 500, amount_paid: 0, paid: true, payments: [] },
  { status: "converted", total: 500, paid: true },
  { status: "converted", total: 500, amount_paid: 0, paid: false, balance: 500 },
  { status: "converted", total: 500, amount_paid: 0, paid: false },
];

Deno.test("getQuotationBalance == backend getBalance en todos los casos", () => {
  for (const q of cases) assertEquals(getQuotationBalance(q), backendGetBalance(q), JSON.stringify(q));
});

Deno.test("sent/accepted con paid=true y amount_paid=0 ya no se muestra como saldo 0 (igual que backend)", () => {
  assertEquals(getQuotationBalance({ status: "sent", total: 500, amount_paid: 0, paid: true }), 500);
});

Deno.test("ventas convertidas y viejas (paid=true, amount_paid=0): saldo 0, sin cambio", () => {
  assertEquals(getQuotationBalance({ status: "converted", total: 500, amount_paid: 0, paid: true, balance: 0, payments: [] }), 0);
  assertEquals(getQuotationBalance({ status: "converted", total: 500, amount_paid: 0, paid: true, payments: [] }), 0);
});
