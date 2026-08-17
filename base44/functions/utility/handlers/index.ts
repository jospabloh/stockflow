import { handle as createUtilityMovementSafe } from './createUtilityMovementSafe.ts';
import { handle as updateUtilityMovementSafe } from './updateUtilityMovementSafe.ts';
import { handle as deleteUtilityMovementSafe } from './deleteUtilityMovementSafe.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  createUtilityMovementSafe,
  updateUtilityMovementSafe,
  deleteUtilityMovementSafe,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
