import { handle as createProductSafe } from './createProductSafe.ts';
import { handle as updateProductSafe } from './updateProductSafe.ts';
import { handle as deleteProductSafe } from './deleteProductSafe.ts';
import { handle as generateBarcodeSafe } from './generateBarcodeSafe.ts';
import { handle as updateProductBarcodeSafe } from './updateProductBarcodeSafe.ts';
import { handle as importItemsSafe } from './importItemsSafe.ts';
import { handle as applyInventoryAuditCorrection } from './applyInventoryAuditCorrection.ts';
import { handle as auditInventory } from './auditInventory.ts';

type Handler = (req: Request) => Promise<Response>;
const HANDLERS: Record<string, Handler> = { createProductSafe, updateProductSafe, deleteProductSafe, generateBarcodeSafe, updateProductBarcodeSafe, importItemsSafe, applyInventoryAuditCorrection, auditInventory };
export function getHandler(action: string): Handler | undefined { return HANDLERS[action]; }
