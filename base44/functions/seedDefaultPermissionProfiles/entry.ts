import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';

const LEGACY_DEFAULTS: Record<string, Record<string, Record<string, boolean>>> = {
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
    Categories: { ver: true, leer: true, escribir: false, modificar: false, eliminar: true },
    Suppliers: { ver: true, leer: true, escribir: false, modificar: false, eliminar: false },
    Clients: { ver: true, leer: true, escribir: true, modificar: true, eliminar: false },
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

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.email !== PLATFORM_OWNER_EMAIL && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const business_id = user.business_id;
    if (!business_id && user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'User has no business_id' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.PermissionProfile.filter({ business_id });

    if (existing.length > 0) {
      return Response.json({ success: true, seeded: false });
    }

    const now = new Date().toISOString();
    await Promise.all(
      Object.entries(LEGACY_DEFAULTS).map(([role_key, permissions]) =>
        base44.asServiceRole.entities.PermissionProfile.create({
          business_id,
          role_key,
          permissions,
          schema_version: 1,
          is_system_default: true,
          created_by: user.email || 'system',
          updated_by: user.email || 'system',
        })
      )
    );

    return Response.json({ success: true, seeded: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
