import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Platform-wide AppVersion record: platform owner only (fails closed if the secret is unset).
    // Built-in role 'admin' is not enough — legacy tenant admins may still carry it.
    if (!user || !PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });
    }

    const { version, release_notes } = await req.json();

    if (!version) {
      return Response.json({ error: 'version is required' }, { status: 400 });
    }

    // Obtener registro existente
    const existing = await base44.asServiceRole.entities.AppVersion.list();
    
    if (existing.length === 0) {
      return Response.json({ error: 'AppVersion no inicializada' }, { status: 404 });
    }

    const record = existing[0];
    const result = await base44.asServiceRole.entities.AppVersion.update(record.id, {
      version,
      release_notes: release_notes || '',
      released_at: new Date().toISOString(),
    });

    return Response.json({ 
      success: true, 
      message: `Versión actualizada a ${version}`,
      previous_version: record.version,
      new_version: result.version
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});