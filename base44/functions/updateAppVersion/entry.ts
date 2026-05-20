import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
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