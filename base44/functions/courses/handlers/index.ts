import { handle as createCourseSafe } from './createCourseSafe.ts';
import { handle as updateCourseSafe } from './updateCourseSafe.ts';
import { handle as deleteCourseSafe } from './deleteCourseSafe.ts';

type Handler = (req: Request) => Promise<Response>;
const HANDLERS: Record<string, Handler> = { createCourseSafe, updateCourseSafe, deleteCourseSafe };
export function getHandler(action: string): Handler | undefined { return HANDLERS[action]; }
