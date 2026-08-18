import { handle as createCatalogItemSafe } from './createCatalogItemSafe.ts';
import { handle as updateCatalogItemSafe } from './updateCatalogItemSafe.ts';
import { handle as deleteCatalogItemSafe } from './deleteCatalogItemSafe.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  createCatalogItemSafe,
  updateCatalogItemSafe,
  deleteCatalogItemSafe,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
