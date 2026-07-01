import { handle as createCategorySafe } from './createCategorySafe.ts';
import { handle as updateCategorySafe } from './updateCategorySafe.ts';
import { handle as deleteCategorySafe } from './deleteCategorySafe.ts';

type Handler = (req: Request) => Promise<Response>;
const HANDLERS: Record<string, Handler> = { createCategorySafe, updateCategorySafe, deleteCategorySafe };
export function getHandler(action: string): Handler | undefined { return HANDLERS[action]; }
