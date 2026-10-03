import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Safe write for Quotation.public_link_enabled/public_token —
 * QuotationPreviewDialog.jsx's handleShare()/handleDisableShare() used to
 * call base44.entities.Quotation.update(...) directly. The client already
 * gates the share button behind can('Cotizaciones', 'share'), but nothing
 * re-checked that server-side, so an almacenista whose admin explicitly
 * revoked 'Cotizaciones:share' could still toggle a public link from
 * devtools (the key is granted by default, so this was not exploitable
 * out of the box — see CLAUDE.md's granular-permissions sections for the
 * same shape of gap on partialReturnQuotation/createQuotationSafe).
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quotation_id, enabled } = body;

    if (!quotation_id || typeof enabled !== 'boolean') {
      return Response.json({ success: false, error: 'quotation_id and a boolean enabled are required' }, { status: 400 });
    }

    const quotations = await base44.asServiceRole.entities.Quotation.filter({ id: quotation_id });
    const quotation = quotations?.[0];
    if (!quotation) {
      return Response.json({ success: false, error: 'Quotation not found' }, { status: 404 });
    }

    if (quotation.business_id !== user.business_id) {
      console.error(
        `[toggleQuotationShareSafe] CROSS-TENANT ATTEMPT: user ${user.email} (business ${user.business_id}) ` +
        `tried to update quotation ${quotation_id} (business ${quotation.business_id})`
      );
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Cotizaciones', 'share');
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Cotizaciones:share' }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const billingStatus = businesses?.[0]?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const updates = enabled
      ? { public_token: crypto.randomUUID(), public_link_enabled: true }
      : { public_link_enabled: false };

    const updated = await base44.asServiceRole.entities.Quotation.update(quotation_id, updates);

    return Response.json({ success: true, quotation_id, quotation: updated });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
