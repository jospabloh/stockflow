import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id } = await req.json();
    if (!session_id) return Response.json({ status: 'not_found' });

    // Obtener sesiones del usuario para validar ownership
    const sessions = await base44.asServiceRole.entities.Session.filter({ user_id: user.id });
    const session = sessions.find(s => s.id === session_id);

    if (!session) return Response.json({ status: 'not_found' });
    if (session.status === 'revoked') return Response.json({ status: 'revoked' });

    // Si está activa, actualizar last_seen
    if (session.status === 'active') {
      await base44.asServiceRole.entities.Session.update(session.id, {
        last_seen: new Date().toISOString()
      });
    }

    return Response.json({ status: session.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});