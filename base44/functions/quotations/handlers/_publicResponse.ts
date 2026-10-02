// The router (entry.ts) consumes body.action as the handler name, so the customer's
// answer travels in body.response. No imports, so it is unit-testable without the SDK.
export function getPublicResponse(body: Record<string, unknown> | null | undefined): 'accepted' | 'rejected' | null {
  const r = body?.response;
  return r === 'accepted' || r === 'rejected' ? r : null;
}
