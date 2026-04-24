import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { role_key, permissions } = await req.json();

    if (!role_key || !permissions) {
      return Response.json({ error: 'Missing role_key or permissions' }, { status: 400 });
    }

    // Buscar perfil existente
    const existing = await base44.entities.PermissionProfile.filter({
      role_key,
      business_id: user.business_id,
    });

    let result;
    if (existing && existing.length > 0) {
      result = await base44.entities.PermissionProfile.update(existing[0].id, {
        permissions,
      });
    } else {
      result = await base44.entities.PermissionProfile.create({
        role_key,
        business_id: user.business_id,
        permissions,
      });
    }

    return Response.json({ success: true, profile: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});