import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';
import { validatePettyCashAmount } from './_validation.ts';

/**
 * Safe PettyCashMovement creation — enforces the granular permission key
 * behind each movement_type (mirrors the button gates in src/pages/PettyCash.jsx)
 * in addition to tenant ownership and write_blocked, none of which the
 * previous direct base44.entities.PettyCashMovement.create() call from the
 * client enforced server-side. See CLAUDE.md "Known gap" for context.
 */

const MOVEMENT_TYPE_ACTION: Record<string, string> = {
  initial_fund: 'add_fund',
  income: 'income',
  expense: 'expense',
  adjustment: 'edit_amount',
};

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { business_id, movement_type, amount, description, category, movement_date, reference, notes } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }
    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` }, { status: 403 });
    }

    const actionId = MOVEMENT_TYPE_ACTION[movement_type];
    if (!actionId) {
      return Response.json({ success: false, error: `Invalid movement_type: ${movement_type}` }, { status: 400 });
    }

    const allowed = await hasPermission(base44.asServiceRole, user, 'Caja Chica', actionId);
    if (!allowed) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: `Caja Chica:${actionId}` }, { status: 403 });
    }

    const businesses = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = businesses[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const amountError = validatePettyCashAmount(amount);
    if (amountError) {
      return Response.json({ success: false, error: amountError }, { status: 400 });
    }
    if (!description || !String(description).trim()) {
      return Response.json({ success: false, error: 'Debes capturar una descripción' }, { status: 400 });
    }
    if (!movement_date) {
      return Response.json({ success: false, error: 'La fecha es obligatoria' }, { status: 400 });
    }

    const movement = await base44.asServiceRole.entities.PettyCashMovement.create({
      business_id,
      movement_type,
      amount,
      description: String(description).trim(),
      category: category || '',
      movement_date,
      reference: reference || '',
      notes: notes || '',
    });

    return Response.json({ success: true, movement_id: movement.id, movement });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
