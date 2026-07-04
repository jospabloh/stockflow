import { handle as createContactSafe } from './createContactSafe.ts';
import { handle as updateContactSafe } from './updateContactSafe.ts';
import { handle as deleteContactSafe } from './deleteContactSafe.ts';

type Handler = (req: Request) => Promise<Response>;
const HANDLERS: Record<string, Handler> = { createContactSafe, updateContactSafe, deleteContactSafe };
export function getHandler(action: string): Handler | undefined { return HANDLERS[action]; }
