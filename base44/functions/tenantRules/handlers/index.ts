import { handle as adminUpsertTenantRule } from './adminUpsertTenantRule.ts';
import { handle as adminListTenantRules } from './adminListTenantRules.ts';
import { handle as adminDeleteTenantRule } from './adminDeleteTenantRule.ts';
import { handle as getCurrentTenantRuleMap } from './getCurrentTenantRuleMap.ts';
import { handle as activateBaristopCashRule } from './activateBaristopCashRule.ts';

type Handler = (req: Request) => Promise<Response>;

const HANDLERS: Record<string, Handler> = {
  adminUpsertTenantRule,
  adminListTenantRules,
  adminDeleteTenantRule,
  getCurrentTenantRuleMap,
  activateBaristopCashRule,
};

export function getHandler(action: string): Handler | undefined {
  return HANDLERS[action];
}
