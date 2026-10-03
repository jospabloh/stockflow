import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Module 7 (cuenta y zona de peligro) — self-service data export.
 *
 * Settings.jsx's "Cuenta" tab had an irreversible delete-account flow but no
 * way for the business to download its own data first. `src/lib/exportData.js`
 * is NOT that: it renders a specific on-screen report to XLSX/PDF, not the
 * tenant's raw rows.
 *
 * Runs as service role, but every read is explicitly filtered by the caller's
 * OWN business_id — re-derived from `auth.me()`, never taken from the request
 * body — so this can never reach another tenant's rows. A failure on any one
 * entity does not fail the whole export: that entity comes back as an empty
 * array plus an entry in `errors`, so a partial export still gets the user
 * their data instead of nothing.
 *
 * `User` is deliberately NOT exported (other members' PII — the team roster is
 * already visible in the Equipo tab) and neither is `EmailNotification`
 * (delivery infrastructure, not the tenant's business data).
 */
const EXPORTED_ENTITIES = [
  'AppSettings',
  'Campaign',
  'Category',
  'Client',
  'Contact',
  'Course',
  'Enrollment',
  'FundAccount',
  'InventoryAuditLog',
  'MachinerySale',
  'Movement',
  'PaymentMethod',
  'PermissionProfile',
  'PettyCashMovement',
  'Product',
  'Quotation',
  'Rubro',
  'Supplier',
  'SupplierPayment',
  'SupportTicket',
  'SupportTicketMessage',
  'TenantRule',
  'UtilityMovement',
];

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ success: false, error: 'No business_id on the caller' }, { status: 400 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Configuracion', 'export_data');
    if (!allowed) {
      return Response.json(
        { success: false, error: 'Forbidden: missing permission', permission: 'Configuracion:export_data' },
        { status: 403 },
      );
    }

    // Read-only: no billing gate. A view_only/suspended tenant must keep being
    // able to take its data out — that is the whole point of the export.

    const data: Record<string, unknown[]> = {};
    const errors: Record<string, string> = {};

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: businessId });
    const business = businesses?.[0] ?? null;

    for (const entity of EXPORTED_ENTITIES) {
      try {
        const rows = await base44.asServiceRole.entities[entity].filter({ business_id: businessId });
        data[entity] = rows || [];
      } catch (error) {
        data[entity] = [];
        errors[entity] = (error as Error).message;
      }
    }

    return Response.json({
      success: true,
      exported_at: new Date().toISOString(),
      business_id: businessId,
      business,
      data,
      ...(Object.keys(errors).length ? { errors } : {}),
    });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
