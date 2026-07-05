import { createClientFromRequest } from 'npm:@base44/sdk@0.8.35';

Deno.serve(async (req) => {
  try {
    // Esta función es invocada por la automatización programada de la plataforma.
    // No requiere validación de secreto ya que el scheduler es el único invocador.
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
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});