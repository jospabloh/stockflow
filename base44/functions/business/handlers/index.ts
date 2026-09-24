import { handle as updateBusinessSafe } from './updateBusinessSafe.ts';
import { handle as updateAppSettingsSafe } from './updateAppSettingsSafe.ts';
import { handle as createAppSettingsSafe } from './createAppSettingsSafe.ts';
import { handle as getBusinessCatalogs } from './getBusinessCatalogs.ts';
import { handle as validateBusinessOwnership } from './validateBusinessOwnership.ts';
import { handle as sendTestLifecycleEmails } from './sendTestLifecycleEmails.ts';
import { handle as createBusinessSafe } from './createBusinessSafe.ts';
import { handle as joinBusinessSafe } from './joinBusinessSafe.ts';
import { handle as exportBusinessData } from './exportBusinessData.ts';
import { handle as aiIntakeTurn } from './aiIntakeTurn.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  updateBusinessSafe,
  updateAppSettingsSafe,
  createAppSettingsSafe,
  getBusinessCatalogs,
  validateBusinessOwnership,
  sendTestLifecycleEmails,
  createBusinessSafe,
  joinBusinessSafe,
  exportBusinessData,
  aiIntakeTurn,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
