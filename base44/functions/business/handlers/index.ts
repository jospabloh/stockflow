import { handle as updateBusinessSafe } from './updateBusinessSafe.ts';
import { handle as updateAppSettingsSafe } from './updateAppSettingsSafe.ts';
import { handle as getBusinessCatalogs } from './getBusinessCatalogs.ts';
import { handle as validateBusinessOwnership } from './validateBusinessOwnership.ts';
import { handle as sendTestLifecycleEmails } from './sendTestLifecycleEmails.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  updateBusinessSafe,
  updateAppSettingsSafe,
  getBusinessCatalogs,
  validateBusinessOwnership,
  sendTestLifecycleEmails,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
