import { handle as createSupplierPaymentSafe } from './createSupplierPaymentSafe.ts';
import { handle as updateSupplierPaymentSafe } from './updateSupplierPaymentSafe.ts';
import { handle as updateSupplierPaymentInvoiceStatusSafe } from './updateSupplierPaymentInvoiceStatusSafe.ts';
import { handle as deleteSupplierPaymentSafe } from './deleteSupplierPaymentSafe.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  createSupplierPaymentSafe,
  updateSupplierPaymentSafe,
  updateSupplierPaymentInvoiceStatusSafe,
  deleteSupplierPaymentSafe,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
