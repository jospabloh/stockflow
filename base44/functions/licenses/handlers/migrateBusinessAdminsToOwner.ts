import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

/**
 * One-shot migration (2026-09-24): moves every business admin still stored as
 * built-in role 'admin' to 'owner'. Built-in 'admin' matches the
 * user_condition:{role:"admin"} branch on every entity's RLS, which is not
 * scoped to a business — verified live: a freshly signed-up business admin
 * could read and write all other businesses.
 *
 * Platform owner only (by email, never by role). Dry run unless
 * `{ apply: true }`. The platform owner is never touched. Idempotent.
 *
 *   base44.functions.invoke('licenses', { action: 'migrateBusinessAdminsToOwner' })
 *   base44.functions.invoke('licenses', { action: 'migrateBusinessAdminsToOwner', apply: true })
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
    if (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const apply = body?.apply === true;

    const users = await base44.asServiceRole.entities.User.list();
    const targets = users.filter((u) => u.role === 'admin' && u.email !== PLATFORM_OWNER_EMAIL);

    const results = [];
    for (const u of targets) {
      if (!apply) {
        results.push({ email: u.email, business_id: u.business_id ?? null, from: 'admin', to: 'owner', applied: false });
        continue;
      }
      try {
        await base44.asServiceRole.entities.User.update(u.id, { role: 'owner' });
        const fresh = (await base44.asServiceRole.entities.User.filter({ id: u.id }))[0];
        results.push({ email: u.email, business_id: u.business_id ?? null, role_now: fresh?.role ?? null, applied: fresh?.role === 'owner' });
      } catch (err) {
        results.push({ email: u.email, applied: false, error: (err as Error).message });
      }
    }

    return Response.json({ success: true, apply, count: targets.length, results });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
