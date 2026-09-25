// Shared by the three support-ticket actions (createSupportTicketSafe,
// replySupportTicketSafe, markSupportTicketReadSafe).
//
// No billing gate on any of them, on purpose: a view_only/suspended tenant must
// still be able to reach support — same reasoning as aiIntakeTurn and
// exportBusinessData.

export const MAX_SUBJECT = 200;
export const MAX_BODY = 20000;

// Mirror the enums in base44/entities/SupportTicket.jsonc.
export const CATEGORIES = new Set(['billing', 'technical', 'account', 'inventory', 'sales', 'feature_request', 'other']);
export const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

export function clip(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

// deno-lint-ignore no-explicit-any
export function authorFields(user: any) {
  return {
    author_id: user.id,
    author_email: user.email,
    author_name: user.full_name || user.email,
    author_role: 'tenant',
  };
}
