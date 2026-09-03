import { handle as createMachinerySaleSafe } from './createMachinerySaleSafe.ts';
import { handle as updateMachinerySaleSafe } from './updateMachinerySaleSafe.ts';
import { handle as deleteMachinerySaleSafe } from './deleteMachinerySaleSafe.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  createMachinerySaleSafe,
  updateMachinerySaleSafe,
  deleteMachinerySaleSafe,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
