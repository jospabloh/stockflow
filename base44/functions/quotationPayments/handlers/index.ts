import { handle as registerQuotationPayment } from './registerQuotationPayment.ts';
import { handle as editQuotationPayment } from './editQuotationPayment.ts';
import { handle as deleteQuotationPayment } from './deleteQuotationPayment.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  registerQuotationPayment,
  editQuotationPayment,
  deleteQuotationPayment,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
