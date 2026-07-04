import { handle as sendEnrollmentEmail } from './sendEnrollmentEmail.ts';
import { handle as sendCampaignEmails } from './sendCampaignEmails.ts';
import { handle as runReminders } from './runReminders.ts';

type Handler = (req: Request) => Promise<Response>;
const HANDLERS: Record<string, Handler> = { sendEnrollmentEmail, sendCampaignEmails, runReminders };
export function getHandler(action: string): Handler | undefined { return HANDLERS[action]; }
