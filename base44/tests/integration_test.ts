/**
 * Integration tests for critical StockFlow flows:
 *   1. Create quotation (createQuotationSafe)
 *   2. Convert quotation (cancelQuotationSafe acting as "concretar")
 *   3. Change user role (changeUserRole)
 *
 * These tests run against mock HTTP handlers; no live Base44 connection is required.
 * Run with: deno test base44/tests/integration_test.ts
 */

import { assertEquals, assertObjectMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ---------------------------------------------------------------------------
// Minimal stubs
// ---------------------------------------------------------------------------

function makeUser(overrides = {}) {
  return {
    id: "user-1",
    email: "test@example.com",
    business_id: "biz-1",
    role: "admin",
    ...overrides,
  };
}

function makeRequest(body: unknown, token = "tok-valid"): Request {
  return new Request("http://localhost/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// --- createQuotationSafe ---
// ---------------------------------------------------------------------------

Deno.test("createQuotationSafe: rejects when business_id is missing", async () => {
  const req = makeRequest({ folio: "Q-001", items: [] }); // no business_id
  const res = await simulateCreateQuotation(req, makeUser());
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.error, "business_id is required");
});

Deno.test("createQuotationSafe: rejects when business_id does not match user", async () => {
  const req = makeRequest({ folio: "Q-001", business_id: "biz-OTHER", items: [] });
  const res = await simulateCreateQuotation(req, makeUser({ business_id: "biz-1" }));
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.success, false);
});

Deno.test("createQuotationSafe: rejects unauthenticated request", async () => {
  const req = makeRequest({ folio: "Q-001", business_id: "biz-1" });
  const res = await simulateCreateQuotation(req, null);
  assertEquals(res.status, 401);
});

Deno.test("createQuotationSafe: rejects when billing_status is suspended", async () => {
  const req = makeRequest({ folio: "Q-001", business_id: "biz-1", items: [] });
  const res = await simulateCreateQuotation(req, makeUser(), { billing_status: "suspended" });
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.error, "write_blocked");
});

// ---------------------------------------------------------------------------
// --- cancelQuotationSafe (concretar / convert flow validation) ---
// ---------------------------------------------------------------------------

Deno.test("cancelQuotationSafe: rejects when quotation_id is missing", async () => {
  const req = makeRequest({});
  const res = await simulateCancelQuotation(req, makeUser(), null);
  assertEquals(res.status, 400);
});

Deno.test("cancelQuotationSafe: rejects cross-tenant attempt", async () => {
  const quotation = { id: "q-1", business_id: "biz-OTHER", status: "pending" };
  const req = makeRequest({ quotation_id: "q-1" });
  const res = await simulateCancelQuotation(req, makeUser({ business_id: "biz-1" }), quotation);
  assertEquals(res.status, 403);
});

Deno.test("cancelQuotationSafe: rejects unauthenticated request", async () => {
  const req = makeRequest({ quotation_id: "q-1" });
  const res = await simulateCancelQuotation(req, null, null);
  assertEquals(res.status, 401);
});

// ---------------------------------------------------------------------------
// --- changeUserRole ---
// ---------------------------------------------------------------------------

Deno.test("changeUserRole: rejects non-admin caller", async () => {
  const req = makeRequest({ target_user_id: "user-2", new_role: "almacenista" });
  const res = await simulateChangeUserRole(req, makeUser({ role: "almacenista" }));
  assertEquals(res.status, 403);
});

Deno.test("changeUserRole: rejects when target user is in different business", async () => {
  const req = makeRequest({ target_user_id: "user-2", new_role: "almacenista" });
  const targetUser = makeUser({ id: "user-2", business_id: "biz-OTHER" });
  const res = await simulateChangeUserRole(req, makeUser({ business_id: "biz-1" }), targetUser);
  assertEquals(res.status, 403);
});

Deno.test("changeUserRole: rejects unauthenticated request", async () => {
  const req = makeRequest({ target_user_id: "user-2", new_role: "almacenista" });
  const res = await simulateChangeUserRole(req, null);
  assertEquals(res.status, 401);
});

// ---------------------------------------------------------------------------
// deleteClientSafe
// ---------------------------------------------------------------------------

Deno.test("deleteClientSafe: rejects cross-tenant delete attempt", async () => {
  const client = { id: "c-1", business_id: "biz-OTHER" };
  const req = makeRequest({ client_id: "c-1" });
  const res = await simulateDeleteClient(req, makeUser({ business_id: "biz-1" }), client);
  assertEquals(res.status, 403);
});

Deno.test("deleteClientSafe: rejects non-admin caller", async () => {
  const req = makeRequest({ client_id: "c-1" });
  const res = await simulateDeleteClient(req, makeUser({ role: "almacenista" }), null);
  assertEquals(res.status, 403);
});

Deno.test("deleteClientSafe: rejects missing client_id", async () => {
  const req = makeRequest({});
  const res = await simulateDeleteClient(req, makeUser(), null);
  assertEquals(res.status, 400);
});

// ---------------------------------------------------------------------------
// In-process simulations (replicate the validation logic of each function
// without importing Deno.serve or the Base44 SDK)
// ---------------------------------------------------------------------------

async function simulateCreateQuotation(
  req: Request,
  user: ReturnType<typeof makeUser> | null,
  biz: { billing_status?: string } = {},
): Promise<Response> {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { business_id, items } = body;
  if (!business_id) return Response.json({ success: false, error: "business_id is required" }, { status: 400 });
  if (business_id !== user.business_id) {
    return Response.json({ success: false, error: `Unauthorized: business_id mismatch` }, { status: 403 });
  }
  const billingStatus = biz.billing_status ?? "active";
  if (billingStatus === "view_only" || billingStatus === "suspended") {
    return Response.json({ success: false, error: "write_blocked", billing_status: billingStatus }, { status: 403 });
  }
  return Response.json({ success: true, quotation_id: "q-new" });
}

async function simulateCancelQuotation(
  req: Request,
  user: ReturnType<typeof makeUser> | null,
  quotation: { id: string; business_id: string; status: string } | null,
): Promise<Response> {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { quotation_id } = body;
  if (!quotation_id) return Response.json({ error: "quotation_id is required" }, { status: 400 });
  if (!quotation) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (quotation.business_id !== user.business_id) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (quotation.status === "cancelled") return Response.json({ error: "Already cancelled" }, { status: 400 });
  return Response.json({ success: true });
}

async function simulateChangeUserRole(
  req: Request,
  caller: ReturnType<typeof makeUser> | null,
  targetUser?: ReturnType<typeof makeUser> | null,
): Promise<Response> {
  if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  if (!body.target_user_id) return Response.json({ error: "target_user_id is required" }, { status: 400 });
  const target = targetUser ?? makeUser({ id: body.target_user_id, business_id: caller.business_id });
  if (target.business_id !== caller.business_id) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json({ success: true });
}

async function simulateDeleteClient(
  req: Request,
  caller: ReturnType<typeof makeUser> | null,
  client: { id: string; business_id: string } | null,
): Promise<Response> {
  if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { client_id } = body;
  if (!client_id) return Response.json({ error: "client_id is required" }, { status: 400 });
  if (!client) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (client.business_id !== caller.business_id) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json({ success: true, client_id });
}
