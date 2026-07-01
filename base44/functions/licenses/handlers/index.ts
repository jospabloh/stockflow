import { handle as adminGetAllLicenses } from './adminGetAllLicenses.ts';
import { handle as adminUpdateTenantLicense } from './adminUpdateTenantLicense.ts';
import { handle as getCurrentTenantLicenseState } from './getCurrentTenantLicenseState.ts';
import { handle as confirmRenewalPayment } from './confirmRenewalPayment.ts';
import { handle as initTenantTrial } from './initTenantTrial.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  adminGetAllLicenses,
  adminUpdateTenantLicense,
  getCurrentTenantLicenseState,
  confirmRenewalPayment,
  initTenantTrial,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
