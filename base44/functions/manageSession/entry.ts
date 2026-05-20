import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { device_id, device_name } = await req.json();
    if (!device_id) return Response.json({ error: 'device_id requerido' }, { status: 400 });

    // Obtener todas las sesiones del usuario (no revocadas)
    const sessions = await base44.asServiceRole.entities.Session.filter({ user_id: user.id });
    const activeSessions = sessions.filter(s => s.status !== 'revoked');

    // Buscar sesión existente para este dispositivo
    const existing = activeSessions.find(s => s.device_id === device_id);

    let session;
    if (existing) {
      // Marcar todas las OTRAS sesiones activas como passive
      for (const s of activeSessions) {
        if (s.id !== existing.id && s.status === 'active') {
          await base44.asServiceRole.entities.Session.update(s.id, { status: 'passive' });
        }
      }
      // Reactivar esta sesión
      session = await base44.asServiceRole.entities.Session.update(existing.id, {
        status: 'active',
        last_seen: new Date().toISOString()
      });
    } else {
      // Marcar todas las sesiones activas como passive
      for (const s of activeSessions) {
        if (s.status === 'active') {
          await base44.asServiceRole.entities.Session.update(s.id, { status: 'passive' });
        }
      }
      // Crear nueva sesión activa
      session = await base44.asServiceRole.entities.Session.create({
        user_id: user.id,
        device_id,
        device_name: device_name || 'Dispositivo desconocido',
        status: 'active',
        last_seen: new Date().toISOString()
      });
    }

    return Response.json({ status: session.status, session_id: session.id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});