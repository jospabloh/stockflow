/**
 * Tests for the granular permission-key enforcement added to the
 * PettyCashMovement / UtilityMovement / SupplierPayment Safe functions
 * (base44/functions/pettyCash, base44/functions/utility,
 * base44/functions/supplierPayments). See CLAUDE.md "Granular permission-key
 * enforcement" for the bug this closes: those entities used to be written
 * directly from the client with no server-side check of the
 * permissionRegistry.js keys the UI already gates on.
 *
 * hasPermission() itself (see each function's handlers/_permissions.ts) has
 * no npm/Base44-SDK imports, so it's imported and exercised directly here —
 * not just simulated like the older tests in integration_test.ts.
 *
 * Run with: deno test base44/tests/permissions_safe_functions_test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hasPermission } from "../functions/pettyCash/handlers/_permissions.ts";

// ---------------------------------------------------------------------------
// Stub asServiceRole.entities.PermissionProfile.filter — the only dependency
// hasPermission() has on the outside world.
// ---------------------------------------------------------------------------

function stubServiceRole(profiles: Array<{ business_id: string; role_key: string; permissions?: Record<string, boolean> }>) {
  return {
    entities: {
      PermissionProfile: {
        filter: (q: Record<string, unknown>) => {
          const matches = profiles.filter(
            (p) => p.business_id === q.business_id && p.role_key === q.role_key,
          );
          return Promise.resolve(matches);
        },
      },
    },
  };
}

const NO_PROFILES = stubServiceRole([]);

// ---------------------------------------------------------------------------

Deno.test("hasPermission: admin is always allowed, regardless of registry defaults", async () => {
  const allowed = await hasPermission(NO_PROFILES, { role: "admin", business_id: "biz-1" }, "Caja Chica", "add_fund");
  assertEquals(allowed, true);
});

Deno.test("hasPermission: null/undefined user is always denied", async () => {
  assertEquals(await hasPermission(NO_PROFILES, null, "Caja Chica", "add_fund"), false);
  assertEquals(await hasPermission(NO_PROFILES, undefined, "Caja Chica", "add_fund"), false);
});

Deno.test("hasPermission: almacenista falls back to the registry default when no profile override exists — denied key", async () => {
  // 'Caja Chica:add_fund' is in ALMACENISTA_DENIED by default.
  const allowed = await hasPermission(NO_PROFILES, { role: "almacenista", business_id: "biz-1" }, "Caja Chica", "add_fund");
  assertEquals(allowed, false);
});

Deno.test("hasPermission: almacenista falls back to the registry default when no profile override exists — granted key", async () => {
  // 'Caja Chica:income' is NOT in ALMACENISTA_DENIED by default.
  const allowed = await hasPermission(NO_PROFILES, { role: "almacenista", business_id: "biz-1" }, "Caja Chica", "income");
  assertEquals(allowed, true);
});

Deno.test("hasPermission: explicit PermissionProfile override (granted) beats the default-denied key", async () => {
  const serviceRole = stubServiceRole([
    { business_id: "biz-1", role_key: "almacenista", permissions: { "Caja Chica:add_fund": true } },
  ]);
  const allowed = await hasPermission(serviceRole, { role: "almacenista", business_id: "biz-1" }, "Caja Chica", "add_fund");
  assertEquals(allowed, true);
});

Deno.test("hasPermission: explicit PermissionProfile override (denied) beats the default-granted key", async () => {
  const serviceRole = stubServiceRole([
    { business_id: "biz-1", role_key: "almacenista", permissions: { "Caja Chica:income": false } },
  ]);
  const allowed = await hasPermission(serviceRole, { role: "almacenista", business_id: "biz-1" }, "Caja Chica", "income");
  assertEquals(allowed, false);
});

Deno.test("hasPermission: profile from a different business is never consulted (tenant-scoped lookup)", async () => {
  const serviceRole = stubServiceRole([
    { business_id: "biz-OTHER", role_key: "almacenista", permissions: { "Caja Chica:add_fund": true } },
  ]);
  const allowed = await hasPermission(serviceRole, { role: "almacenista", business_id: "biz-1" }, "Caja Chica", "add_fund");
  assertEquals(allowed, false); // falls through to the registry default (denied), not the other business's override
});

Deno.test("hasPermission: unknown role has no registry defaults and is denied", async () => {
  const allowed = await hasPermission(NO_PROFILES, { role: "guest", business_id: "biz-1" }, "Caja Chica", "income");
  assertEquals(allowed, false);
});

Deno.test("hasPermission: Utilidad:add_withdrawal is denied by default for almacenista", async () => {
  const allowed = await hasPermission(NO_PROFILES, { role: "almacenista", business_id: "biz-1" }, "Utilidad", "add_withdrawal");
  assertEquals(allowed, false);
});

// Decision de JP 2026-10-05: el almacenista nace como el de Baristop, sin pagos a proveedores.
Deno.test("hasPermission: Pagos a Proveedores:create is denied by default for almacenista", async () => {
  const allowed = await hasPermission(NO_PROFILES, { role: "almacenista", business_id: "biz-1" }, "Pagos a Proveedores", "create");
  assertEquals(allowed, false);
});

Deno.test("hasPermission: un perfil explicito con Pagos a Proveedores:create=true sigue concediendolo", async () => {
  const serviceRole = {
    entities: { PermissionProfile: { filter: async () => [{ permissions: { "Pagos a Proveedores:create": true } }] } },
  };
  const allowed = await hasPermission(serviceRole, { role: "almacenista", business_id: "biz-1" }, "Pagos a Proveedores", "create");
  assertEquals(allowed, true);
});

Deno.test("hasPermission: Pagos a Proveedores:delete is denied by default for almacenista", async () => {
  const allowed = await hasPermission(NO_PROFILES, { role: "almacenista", business_id: "biz-1" }, "Pagos a Proveedores", "delete");
  assertEquals(allowed, false);
});

// ---------------------------------------------------------------------------
// Handler-level checks — replicate each Safe function's request-validation
// order (auth → business_id/tenant → permission → write_blocked → field
// validation) the same way integration_test.ts already does for the other
// Safe functions, so a business_id/permission-order regression is caught
// without needing a live Base44 connection.
// ---------------------------------------------------------------------------

function makeUser(overrides: Record<string, unknown> = {}) {
  return { id: "user-1", email: "test@example.com", business_id: "biz-1", role: "almacenista", ...overrides };
}

async function simulateCreatePettyCash(
  user: ReturnType<typeof makeUser> | null,
  body: Record<string, unknown>,
  serviceRole = NO_PROFILES,
  biz: { billing_status?: string } = {},
): Promise<Response> {
  if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { business_id, movement_type } = body;
  if (!business_id) return Response.json({ success: false, error: "business_id is required" }, { status: 400 });
  if (business_id !== user.business_id) return Response.json({ success: false, error: "mismatch" }, { status: 403 });

  const MOVEMENT_TYPE_ACTION: Record<string, string> = { initial_fund: "add_fund", income: "income", expense: "expense", adjustment: "edit_amount" };
  const actionId = MOVEMENT_TYPE_ACTION[movement_type as string];
  if (!actionId) return Response.json({ success: false, error: "Invalid movement_type" }, { status: 400 });

  const allowed = await hasPermission(serviceRole, user, "Caja Chica", actionId);
  if (!allowed) return Response.json({ success: false, error: "Forbidden: missing permission" }, { status: 403 });

  const billingStatus = biz.billing_status ?? "active";
  if (billingStatus === "view_only" || billingStatus === "suspended") {
    return Response.json({ success: false, error: "write_blocked", billing_status: billingStatus }, { status: 403 });
  }
  return Response.json({ success: true, movement_id: "pc-new" });
}

Deno.test("createPettyCashMovementSafe (simulated): almacenista without add_fund is rejected for initial_fund", async () => {
  const res = await simulateCreatePettyCash(makeUser(), { business_id: "biz-1", movement_type: "initial_fund", amount: 100 });
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.success, false);
});

Deno.test("createPettyCashMovementSafe (simulated): almacenista without add_fund CAN still create an income movement", async () => {
  const res = await simulateCreatePettyCash(makeUser(), { business_id: "biz-1", movement_type: "income", amount: 100 });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
});

Deno.test("createPettyCashMovementSafe (simulated): admin bypasses the permission check entirely", async () => {
  const res = await simulateCreatePettyCash(makeUser({ role: "admin" }), { business_id: "biz-1", movement_type: "initial_fund", amount: 100 });
  assertEquals(res.status, 200);
});

Deno.test("createPettyCashMovementSafe (simulated): explicit grant in PermissionProfile unblocks add_fund for almacenista", async () => {
  const serviceRole = stubServiceRole([
    { business_id: "biz-1", role_key: "almacenista", permissions: { "Caja Chica:add_fund": true } },
  ]);
  const res = await simulateCreatePettyCash(makeUser(), { business_id: "biz-1", movement_type: "initial_fund", amount: 100 }, serviceRole);
  assertEquals(res.status, 200);
});

Deno.test("createPettyCashMovementSafe (simulated): write_blocked still applies even when permission is granted", async () => {
  const res = await simulateCreatePettyCash(makeUser(), { business_id: "biz-1", movement_type: "income", amount: 100 }, NO_PROFILES, { billing_status: "suspended" });
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.error, "write_blocked");
});

Deno.test("createPettyCashMovementSafe (simulated): cross-tenant business_id is rejected before the permission check", async () => {
  const res = await simulateCreatePettyCash(makeUser({ business_id: "biz-1" }), { business_id: "biz-OTHER", movement_type: "income", amount: 100 });
  assertEquals(res.status, 403);
});

Deno.test("createPettyCashMovementSafe (simulated): rejects unauthenticated request", async () => {
  const res = await simulateCreatePettyCash(null, { business_id: "biz-1", movement_type: "income", amount: 100 });
  assertEquals(res.status, 401);
});
