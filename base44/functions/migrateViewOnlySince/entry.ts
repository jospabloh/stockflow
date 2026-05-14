import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

/**
 * One-time admin migration: seeds view_only_since for existing view_only businesses.
 * Run ONCE after deploying checkAccountLifecycle. Safe to re-run — skips businesses
 * that already have view_only_since set.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.list();
    const toMigrate = businesses.filter(
      (b: any) => b.billing_status === 'view_only' && !b.view_only_since
    );

    let migrated = 0;
    const details: Array<{ id: string; name: string; view_only_since: string }> = [];

    for (const biz of toMigrate) {
      // Use trial_end_at as the best estimate of when they entered view_only;
      // fallback to now — giving them a fresh 15-day countdown.
      const viewOnlySince = biz.trial_end_at || new Date().toISOString();
      await base44.asServiceRole.entities.Business.update(biz.id, { view_only_since: viewOnlySince });
      migrated++;
      details.push({ id: biz.id, name: biz.name, view_only_since: viewOnlySince });
    }

    console.log(`[migrateViewOnlySince] Migrated ${migrated} businesses`);
    return Response.json({
      success: true,
      total_view_only: toMigrate.length,
      migrated,
      details,
    });

  } catch (error: Error | unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return Response.json({ error: err.message }, { status: 500 });
  }
});
