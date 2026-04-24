import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
const VALID_ROLE_KEYS = new Set(['admin', 'almacenista']);

function applySafetyInvariants(role_key: string, permissions: Record<string, boolean>) {
  const result = { ...permissions };

  // Admin siempre puede ver Configuración y Centro de Ayuda
  if (role_key === 'admin') {
    result['Configuración:view'] = true;
  }

  // Todos pueden ver Centro de Ayuda y Acerca de
  result['Centro de Ayuda:view'] = true;
  result['Acerca de:view'] = true;

  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.email !== PLATFORM_OWNER_EMAIL && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { role_key, permissions } = body;

    if (!role_key || !VALID_ROLE_KEYS.has(role_key)) {
      return Response.json({ error: 'role_key must be admin or almacenista' }, { status: 400 });
    }

    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
      return Response.json({ error: 'permissions must be a flat object with string keys and boolean values' }, { status: 400 });
    }

    const business_id = user.business_id;
    if (!business_id && user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'User has no business_id' }, { status: 400 });
    }

    const safePermissions = applySafetyInvariants(role_key, permissions);

    const existing = await base44.asServiceRole.entities.PermissionProfile.filter({ business_id, role_key });

    const payload = {
      business_id,
      role_key,
      permissions: safePermissions,
      schema_version: 1,
      is_system_default: false,
      updated_by: user.email || 'unknown',
    };

    let profile;
    if (existing.length > 0) {
      profile = await base44.asServiceRole.entities.PermissionProfile.update(existing[0].id, payload);
    } else {
      profile = await base44.asServiceRole.entities.PermissionProfile.create({
        ...payload,
        created_by: user.email || 'unknown',
      });
    }

    return Response.json({ success: true, profile });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});