/**
 * trackUserActivity — Safe, throttled activity tracker.
 * Updates last_active_at on the authenticated user, at most once every 15 minutes per session.
 * Tenant-safe: only updates the calling user's own record.
 * Does NOT touch business_id, role, or any other field.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const THROTTLE_MINUTES = 15;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user || !user.id) {
      return Response.json({ skipped: true, reason: 'unauthenticated' }, { status: 200 });
    }

    // Fetch current user record to check last_active_at (throttle check)
    let currentUser = null;
    try {
      const users = await base44.entities.User.filter({ id: user.id });
      currentUser = users?.[0] || null;
    } catch (_) {
      // If we can't fetch, proceed to update anyway (safe fallback)
    }

    const nowMs = Date.now();
    if (currentUser?.last_active_at) {
      const lastActiveMs = new Date(currentUser.last_active_at).getTime();
      if (!isNaN(lastActiveMs) && nowMs - lastActiveMs < THROTTLE_MINUTES * 60 * 1000) {
        return Response.json({ skipped: true, reason: 'throttled', next_update_in_ms: (THROTTLE_MINUTES * 60 * 1000) - (nowMs - lastActiveMs) });
      }
    }

    // Update only last_active_at — no other fields touched
    await base44.auth.updateMe({ last_active_at: new Date(nowMs).toISOString() });

    return Response.json({ success: true, last_active_at: new Date(nowMs).toISOString() });

  } catch (error) {
    // Never crash the UI — log and return soft success
    console.error('[trackUserActivity] Error:', error?.message || error);
    return Response.json({ skipped: true, reason: 'error', detail: error?.message }, { status: 200 });
  }
});