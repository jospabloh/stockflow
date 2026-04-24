import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
const VALID_ROLE_KEYS = new Set(['admin', 'almacenista']);

const SAFETY_INVARIANTS: Record<string, Record<string, boolean>> = {
  admin: { 'Settings.ver': true, 'Settings.leer': true },
};

const ALWAYS_VISIBLE: Record<string, boolean> = {
  'About.ver': true,
  'About.leer': true,
  'HelpCenter.ver': true,
  'HelpCenter.leer': true,
};

function applySafetyInvariants(role_key: string, permissions: Record<string, Record<string, boolean>>) {
  const result: Record<string, Record<string, boolean>> = { ...permissions };

  if (role_key === 'admin') {
    result['Settings'] = { ...(result['Settings'] || {}), ver: true, leer: true };
  }

  for (const artifact of ['About', 'HelpCenter']) {
    result[artifact] = { ...(result[artifact] || {}), ver: true, leer: true };
  }

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
      return Response.json({ error: 'permissions must be a JSON object' }, { status: 400 });
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
