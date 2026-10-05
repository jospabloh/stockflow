// Saldo pendiente de una cotización, con la misma regla que el backend
// (quotationPayments/registerQuotationPayment).
//
// En cotizaciones enviadas/aceptadas (anticipos) el campo `balance` guardado
// no es confiable: createQuotationSafe no lo llena y el esquema lo deja en 0,
// lo que hacía ver toda cotización como pagada. Ahí se deriva:
// max(0, total - amount_paid), sin mirar `paid` (igual que el backend).
// En cualquier otro estado (convertidas, ventas viejas con paid=true y
// amount_paid=0, etc.) se conserva el comportamiento anterior.

export function getQuotationAmountPaid(q) {
  if (q.amount_paid != null) return q.amount_paid;
  return q.paid ? (q.total || 0) : 0;
}

export function getQuotationBalance(q) {
  const total = q.total || 0;
  if (q.status === "sent" || q.status === "accepted") {
    return Math.max(0, total - getQuotationAmountPaid(q));
  }
  if (q.balance != null) return q.balance;
  if (q.paid) return 0;
  return total - getQuotationAmountPaid(q);
}
