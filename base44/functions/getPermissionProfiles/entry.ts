import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener todos los perfiles de permisos del negocio
    const allProfiles = await base44.entities.PermissionProfile.filter({
      business_id: user.business_id,
    });

    const profiles = {};
    const featureEnabled = true; // Por defecto activado

    if (allProfiles) {
      allProfiles.forEach(profile => {
        profiles[profile.role_key] = profile.permissions || {};
      });
    }

    return Response.json({ 
      success: true,
      profiles,
      featureEnabled,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});