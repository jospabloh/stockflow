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

    // Verificar si ya existe un registro
    const existing = await base44.asServiceRole.entities.AppVersion.list();
    
    if (existing.length > 0) {
      // Actualizar versión existente
      const version = existing[0].version;
      return Response.json({ 
        success: true, 
        message: `AppVersion ya existe. Versión actual: ${version}`,
        current_version: version
      });
    }

    // Crear registro inicial
    const result = await base44.asServiceRole.entities.AppVersion.create({
      version: "1.0.0",
      release_notes: "Versión inicial de StockFlow",
      released_at: new Date().toISOString(),
    });

    return Response.json({ 
      success: true, 
      message: 'AppVersion inicializada correctamente',
      version: result.version
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});