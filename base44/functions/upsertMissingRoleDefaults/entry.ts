import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Inserts default permission profiles for any role that doesn't have one yet.
 * Safe: never overwrites existing profiles.
 * Any admin of the tenant can call this (or platform admin).
 */

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

const ROLE_DEFAULTS = {
  admin: {
    Dashboard: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Products: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Movements: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Quotations: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Reports: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Settings: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    PettyCash: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    BarcodeGenerator: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Categories: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Suppliers: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    Clients: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    PaymentMethods: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    SupplierPayments: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    HelpCenter: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
    About: { ver: true, leer: true, escribir: true, modificar: true, eliminar: true },
  },
  almacenista: {
    Dashboard: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    Products: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    Movements: { ver: true, leer: true, escribir: true, modificar: false, eliminar: false },
    Quotations: { ver: true, leer: true, escribir: true, modificar: true, eliminar: false },
    Reports: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    Settings: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    PettyCash: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    BarcodeGenerator: { ver: true, leer: true, escribir: true, modificar: false, eliminar: false },
    Categories: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    Suppliers: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    Clients: { ver: true, leer: true, escribir: true, modificar: true, eliminar: false },
    PaymentMethods: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    SupplierPayments: { ver: false, leer: false, escribir: false, modificar: false, eliminar: false },
    HelpCenter: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    About: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
  },
  vendedor: {
    Dashboard: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    Products: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    Movements: { ver: true, leer: true, escribir: true, modificar: false, eliminar: false },
    Quotations: { ver: true, leer: true, escribir: true, modificar: true, eliminar: false },
    Reports: { ver: false, leer: false, escribir: false, modificar: false, eliminar: false },
    Settings: { ver: false, leer: false, escribir: false, modificar: false, eliminar: false },
    PettyCash: { ver: false, leer: false, escribir: false, modificar: false, eliminar: false },
    BarcodeGenerator: { ver: false, leer: false, escribir: false, modificar: false, eliminar: false },
    Categories: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    Suppliers: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    Clients: { ver: true, leer: true, escribir: true, modificar: false, eliminar: false },
    PaymentMethods: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    SupplierPayments: { ver: false, leer: false, escribir: false, modificar: false, eliminar: false },
    HelpCenter: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    About: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Allow tenant admin or platform owner
    if (user.role !== 'admin' && user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Allow platform admin to specify a target business_id
    const business_id = (user.email === PLATFORM_OWNER_EMAIL && body.business_id)
      ? body.business_id
      : user.business_id;

    if (!business_id) return Response.json({ error: 'No business_id found' }, { status: 400 });

    // Get existing profiles for this tenant
    const existing = await base44.asServiceRole.entities.PermissionProfile.filter({ business_id });
    const existingRoles = new Set(existing.map((p) => p.role_key));

    const created = [];
    const skipped = [];

    for (const [role_key, permissions] of Object.entries(ROLE_DEFAULTS)) {
      if (existingRoles.has(role_key)) {
        skipped.push(role_key);
        continue;
      }
      await base44.asServiceRole.entities.PermissionProfile.create({
        business_id,
        role_key,
        permissions,
      });
      created.push(role_key);
    }

    return Response.json({ success: true, business_id, created, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});