// src/lib/nonCashInvoicing.js

/**
 * Sum of all payments on a quotation whose method is NOT cash ("efectivo").
 *
 * Prefers the itemized `payments[]` ledger (partial payments); a quotation
 * paid via the one-shot "Confirmar Pago Total" flow sets `paid`/
 * `payment_method` without ever appending to `payments[]`, so without this
 * fallback those quotations silently never show up in this report even
 * though they were genuinely paid non-cash (see quotationsFinancialSummary.js
 * for the same fallback used by the Cotizaciones summary bar).
 */
export function nonCashAmount(quotation) {
  const payments = Array.isArray(quotation?.payments) ? quotation.payments : [];
  if (payments.length > 0) {
    return payments
      .filter((p) => !String(p.payment_method || "").toLowerCase().includes("efectivo"))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }
  if (quotation?.paid && !String(quotation.payment_method || "").toLowerCase().includes("efectivo")) {
    return quotation.total || 0;
  }
  return 0;
}

/**
 * Prorates a non-cash amount into its pre-IVA and IVA portions, using the
 * quotation's own subtotal/total ratio (payments aren't tied to specific
 * line items, which can carry mixed tax rates).
 */
export function proratePreIva(quotation, amount) {
  const total = quotation?.total || 0;
  const subtotal = quotation?.subtotal || 0;
  if (total <= 0) {
    return { preIva: amount, iva: 0 };
  }
  const preIva = amount * (subtotal / total);
  return { preIva, iva: amount - preIva };
}

/**
 * A quotation belongs in the "factura a público en general" report when it's
 * a real sale (converted, never cancelled), the customer didn't request an
 * individual invoice, it has a non-cash payment component, and it hasn't
 * already been folded into a prior invoice.
 */
export function isEligibleForNonCashInvoicing(quotation) {
  return (
    quotation?.status === "converted" &&
    quotation?.invoice_status === "no_requerida" &&
    !quotation?.invoice_number &&
    nonCashAmount(quotation) > 0
  );
}
