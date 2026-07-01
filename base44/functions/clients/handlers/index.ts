import { handle as createClientSafe } from './createClientSafe.ts';
import { handle as updateClientSafe } from './updateClientSafe.ts';
import { handle as deleteClientSafe } from './deleteClientSafe.ts';

type Handler = (req: Request) => Promise<Response>;
const HANDLERS: Record<string, Handler> = { createClientSafe, updateClientSafe, deleteClientSafe };
export function getHandler(action: string): Handler | undefined { return HANDLERS[action]; }
