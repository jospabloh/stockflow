import { handle as getPermissionProfiles } from './getPermissionProfiles.ts';
import { handle as upsertPermissionProfile } from './upsertPermissionProfile.ts';
import { handle as seedDefaultPermissionProfiles } from './seedDefaultPermissionProfiles.ts';
import { handle as backfillPermissionDefaults } from './backfillPermissionDefaults.ts';
import { handle as changeUserRole } from './changeUserRole.ts';
import { handle as getTeamMembers } from './getTeamMembers.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  getPermissionProfiles,
  upsertPermissionProfile,
  seedDefaultPermissionProfiles,
  backfillPermissionDefaults,
  changeUserRole,
  getTeamMembers,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
