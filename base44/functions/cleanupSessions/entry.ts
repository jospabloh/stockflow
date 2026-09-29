import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const cronSecretEnv = Deno.env.get('CRON_SECRET');
    const validCron = cronSecretEnv && (
      req.headers.get('x-cron-secret') === cronSecretEnv ||
      body?.['x-cron-secret'] === cronSecretEnv
    );
    if (!validCron) {
      // Revoca sesiones de TODOS los tenants: el disparo manual es sólo del dueño de la
      // plataforma (falla cerrado si PLATFORM_OWNER_EMAIL no está puesto), no de cualquier
      // role 'admin' — un admin de tenant legado podría cerrar sesiones de otros negocios.
      const user = await base44.auth.me().catch(() => null);
      if (!user || !PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Sesiones con last_seen hace más de 30 días
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const active = await base44.asServiceRole.entities.Session.filter({ status: 'active' });
    const passive = await base44.asServiceRole.entities.Session.filter({ status: 'passive' });
    const all = [...active, ...passive];

    let revoked = 0;
    for (const session of all) {
      if (!session.last_seen || session.last_seen < cutoff) {
        await base44.asServiceRole.entities.Session.update(session.id, { status: 'revoked' });
        revoked++;
      }
    }

    return Response.json({ message: `Limpieza completada`, revoked });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});