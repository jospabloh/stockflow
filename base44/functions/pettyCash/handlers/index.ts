import { handle as createPettyCashMovementSafe } from './createPettyCashMovementSafe.ts';
import { handle as updatePettyCashMovementSafe } from './updatePettyCashMovementSafe.ts';
import { handle as deletePettyCashMovementSafe } from './deletePettyCashMovementSafe.ts';
import { handle as syncCashSaleToPettyCash } from './syncCashSaleToPettyCash.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  createPettyCashMovementSafe,
  updatePettyCashMovementSafe,
  deletePettyCashMovementSafe,
  syncCashSaleToPettyCash,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
