import { handle as createSupplierSafe } from './createSupplierSafe.ts';
import { handle as updateSupplierSafe } from './updateSupplierSafe.ts';
import { handle as deleteSupplierSafe } from './deleteSupplierSafe.ts';

type Handler = (req: Request) => Promise<Response>;
const HANDLERS: Record<string, Handler> = { createSupplierSafe, updateSupplierSafe, deleteSupplierSafe };
export function getHandler(action: string): Handler | undefined { return HANDLERS[action]; }
