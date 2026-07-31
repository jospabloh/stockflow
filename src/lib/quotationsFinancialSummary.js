import { calculateLineVAT } from "./vatCalculator";

/**
 * Aggregates the fiscal + payment-method picture across converted quotations
 * (ventas concretadas) — draft/sent/accepted are proposals, not tax events,
 * and cancelled sales reverse their movements, so neither belongs in totals.
 *
 * Payment split prefers the itemized `payments[]` ledger (partial payments);
 * for quotations paid via the one-shot "Confirmar Pago Total" flow, which
 * sets `paid`/`payment_method` without appending to `payments[]`, it falls
 * back to attributing the full `total` to that single method.
 */
export function summarizeQuotationsFinancials(quotations) {
  const sales = (quotations || []).filter((q) => q.status === "converted");

  let base16 = 0;
  let iva16 = 0;
  let base0 = 0;
  let cashPaid = 0;
  let otherPaid = 0;

  for (const q of sales) {
    for (const item of q.items || []) {
      const { netBase, vat } = calculateLineVAT(item.total || 0, item.tax_rate);
      if (item.tax_rate === 16) {
        base16 += netBase;
        iva16 += vat;
      } else {
        base0 += netBase;
      }
    }

    const payments = Array.isArray(q.payments) ? q.payments : [];
    if (payments.length > 0) {
      for (const p of payments) {
        const isCash = String(p.payment_method || "").toLowerCase().includes("efectivo");
        if (isCash) cashPaid += p.amount || 0;
        else otherPaid += p.amount || 0;
      }
    } else if (q.paid) {
      const isCash = String(q.payment_method || "").toLowerCase().includes("efectivo");
      const amount = q.total || 0;
      if (isCash) cashPaid += amount;
      else otherPaid += amount;
    }
  }

  const subtotal = base16 + base0;
  const total = subtotal + iva16;

  return {
    count: sales.length,
    base16,
    iva16,
    base0,
    subtotal,
    total,
    cashPaid,
    otherPaid,
  };
}
