// Pure input validators for the Quotation Safe functions (no SDK imports so
// they can be unit-tested directly). Each returns null when valid, otherwise a
// human-readable error that handlers answer with HTTP 400.

export const INVOICE_STATUSES = ['pendiente', 'emitida', 'no_requerida', 'na'];

export function validateInvoiceStatus(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return INVOICE_STATUSES.includes(value as string)
    ? null
    : `invoice_status must be one of: ${INVOICE_STATUSES.join(', ')}`;
}

function checkNonNegative(name: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return `${name} must be a number >= 0`;
  }
  return null;
}

export function validateItems(items: unknown): string | null {
  if (!Array.isArray(items)) return 'items must be an array';
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== 'object') return `items[${i}] must be an object`;
    for (const f of ['quantity', 'unit_price', 'total']) {
      const err = checkNonNegative(`items[${i}].${f}`, (it as Record<string, unknown>)[f]);
      if (err) return err;
    }
  }
  return null;
}

function validateClientName(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? null : 'client_name is required';
}

function validateAmounts(b: Record<string, unknown>): string | null {
  for (const f of ['subtotal', 'tax', 'total']) {
    const err = checkNonNegative(f, b[f]);
    if (err) return err;
  }
  return null;
}

export function validateQuotationCreate(b: Record<string, unknown>): string | null {
  return validateClientName(b.client_name)
    || validateItems(b.items)
    || validateAmounts(b)
    || validateInvoiceStatus(b.invoice_status);
}

export function validateQuotationUpdates(u: Record<string, unknown>): string | null {
  if ('client_name' in u) {
    const e = validateClientName(u.client_name);
    if (e) return e;
  }
  if ('items' in u) {
    const e = validateItems(u.items);
    if (e) return e;
  }
  return validateAmounts(u) || validateInvoiceStatus(u.invoice_status);
}
