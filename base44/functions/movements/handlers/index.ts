import { handle as createMovementSafe } from './createMovementSafe.ts';
import { handle as deleteMovementSafe } from './deleteMovementSafe.ts';
import { handle as confirmMovementPaymentSafe } from './confirmMovementPaymentSafe.ts';
import { handle as updateMovementPaymentDetailsSafe } from './updateMovementPaymentDetailsSafe.ts';

type Handler = (req: Request) => Promise<Response>;
const HANDLERS: Record<string, Handler> = { createMovementSafe, deleteMovementSafe, confirmMovementPaymentSafe, updateMovementPaymentDetailsSafe };
export function getHandler(action: string): Handler | undefined { return HANDLERS[action]; }
