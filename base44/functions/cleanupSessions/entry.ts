import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    // Validar clave secreta enviada por la automatización en function_args
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret || body['x-cron-secret'] !== cronSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);

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
    return Response.json({ error: error.message }, { status: 500 });
  }
});