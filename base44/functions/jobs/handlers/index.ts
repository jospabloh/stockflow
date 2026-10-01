import { handle as sendLifecycleEmails } from './sendLifecycleEmails.ts';
import { handle as processTrialReactivationEmails } from './processTrialReactivationEmails.ts';
import { handle as dailyPermissionAudit } from './dailyPermissionAudit.ts';
import { handle as dailyDocumentationAudit } from './dailyDocumentationAudit.ts';
import { handle as dailyStockReconcile } from './dailyStockReconcile.ts';
import { handle as cleanupSessions } from './cleanupSessions.ts';

type Handler = (req: Request) => Promise<Response>;

// Cada handler conserva VERBATIM su propia validación x-cron-secret / platform-owner:
// el router no añade ni quita seguridad.
const HANDLERS: Record<string, Handler> = {
  sendLifecycleEmails,
  processTrialReactivationEmails,
  dailyPermissionAudit,
  dailyDocumentationAudit,
  dailyStockReconcile,
  cleanupSessions,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
