import { handle as createEnrollmentSafe } from './createEnrollmentSafe.ts';
import { handle as updateEnrollmentSafe } from './updateEnrollmentSafe.ts';
import { handle as deleteEnrollmentSafe } from './deleteEnrollmentSafe.ts';

type Handler = (req: Request) => Promise<Response>;
const HANDLERS: Record<string, Handler> = { createEnrollmentSafe, updateEnrollmentSafe, deleteEnrollmentSafe };
export function getHandler(action: string): Handler | undefined { return HANDLERS[action]; }
