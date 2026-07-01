import { handle as manageSession } from './manageSession.ts';
import { handle as sessionHeartbeat } from './sessionHeartbeat.ts';
import { handle as trackUserActivity } from './trackUserActivity.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  manageSession,
  sessionHeartbeat,
  trackUserActivity,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
