import { handle as applyReferralCode } from './applyReferralCode.ts';
import { handle as getReferralStats } from './getReferralStats.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  applyReferralCode,
  getReferralStats,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
