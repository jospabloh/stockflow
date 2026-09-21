import { handle as createMachinerySaleSafe } from './createMachinerySaleSafe.ts';
import { handle as updateMachinerySaleSafe } from './updateMachinerySaleSafe.ts';
import { handle as deleteMachinerySaleSafe } from './deleteMachinerySaleSafe.ts';
import { handle as listMachinerySalesSafe } from './listMachinerySalesSafe.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  createMachinerySaleSafe,
  updateMachinerySaleSafe,
  deleteMachinerySaleSafe,
  listMachinerySalesSafe,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
