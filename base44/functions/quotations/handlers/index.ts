import { handle as createQuotationSafe } from './createQuotationSafe.ts';
import { handle as updateQuotationSafe } from './updateQuotationSafe.ts';
import { handle as updateQuotationFlagsSafe } from './updateQuotationFlagsSafe.ts';
import { handle as cancelQuotationSafe } from './cancelQuotationSafe.ts';
import { handle as convertQuotationSafe } from './convertQuotationSafe.ts';
import { handle as deliverQuotationSafe } from './deliverQuotationSafe.ts';
import { handle as regenerateQuotation } from './regenerateQuotation.ts';
import { handle as partialReturnQuotation } from './partialReturnQuotation.ts';
import { handle as calculateQuotationWithTransport } from './calculateQuotationWithTransport.ts';
import { handle as respondToPublicQuotation } from './respondToPublicQuotation.ts';
import { handle as getPublicQuotation } from './getPublicQuotation.ts';
import { handle as revertPaymentConfirmationSafe } from './revertPaymentConfirmationSafe.ts';
import { handle as registerOnDemandArrivalSafe } from './registerOnDemandArrivalSafe.ts';
import { handle as toggleQuotationShareSafe } from './toggleQuotationShareSafe.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  createQuotationSafe,
  updateQuotationSafe,
  updateQuotationFlagsSafe,
  cancelQuotationSafe,
  convertQuotationSafe,
  deliverQuotationSafe,
  regenerateQuotation,
  partialReturnQuotation,
  calculateQuotationWithTransport,
  respondToPublicQuotation,
  getPublicQuotation,
  revertPaymentConfirmationSafe,
  registerOnDemandArrivalSafe,
  toggleQuotationShareSafe,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}