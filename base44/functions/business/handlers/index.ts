import { handle as updateBusinessSafe } from './updateBusinessSafe.ts';
import { handle as updateAppSettingsSafe } from './updateAppSettingsSafe.ts';
import { handle as createAppSettingsSafe } from './createAppSettingsSafe.ts';
import { handle as getBusinessCatalogs } from './getBusinessCatalogs.ts';
import { handle as validateBusinessOwnership } from './validateBusinessOwnership.ts';
import { handle as sendTestLifecycleEmails } from './sendTestLifecycleEmails.ts';
import { handle as createBusinessSafe } from './createBusinessSafe.ts';
import { handle as joinBusinessSafe } from './joinBusinessSafe.ts';
import { handle as myJoinRequest } from './myJoinRequest.ts';
import { handle as cancelJoinRequest } from './cancelJoinRequest.ts';
import { handle as listJoinRequests } from './listJoinRequests.ts';
import { handle as resolveJoinRequest } from './resolveJoinRequest.ts';
import { handle as exportBusinessData } from './exportBusinessData.ts';
import { handle as aiIntakeTurn } from './aiIntakeTurn.ts';
import { handle as createSupportTicketSafe } from './createSupportTicketSafe.ts';
import { handle as replySupportTicketSafe } from './replySupportTicketSafe.ts';
import { handle as markSupportTicketReadSafe } from './markSupportTicketReadSafe.ts';
import { handle as listAdminNotices } from './listAdminNotices.ts';
import { handle as markAdminNoticeReadSafe } from './markAdminNoticeReadSafe.ts';

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
  myJoinRequest,
  cancelJoinRequest,
  listJoinRequests,
  resolveJoinRequest,
  exportBusinessData,
  aiIntakeTurn,
  createSupportTicketSafe,
  replySupportTicketSafe,
  markSupportTicketReadSafe,
  listAdminNotices,
  markAdminNoticeReadSafe,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
