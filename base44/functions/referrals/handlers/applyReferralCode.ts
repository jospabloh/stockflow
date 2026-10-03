import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { getAuthUser } from '../../../shared/authUser.ts';

const BONUS_DAYS = 15;

function addDays(dateStr: string | null | undefined, days: number): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user || !user.business_id) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { business_id, referral_code } = await req.json();
    if (!business_id || !referral_code) {
      return Response.json({ error: 'business_id y referral_code son requeridos' }, { status: 400 });
    }

    // CRITICAL: Validate user owns this business — prevents IDOR.
    // The function operates via asServiceRole (bypasses RLS), so the
    // client-supplied business_id must be tied back to the authenticated user.
    if (business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const code = String(referral_code).toUpperCase().trim();

    const [referrers, currentList] = await Promise.all([
      base44.asServiceRole.entities.Business.filter({ referral_code: code }),
      base44.asServiceRole.entities.Business.filter({ id: business_id }),
    ]);

    const currentBusiness = currentList[0];
    if (!currentBusiness) {
      return Response.json({ error: 'Negocio no encontrado' }, { status: 404 });
    }
    if (referrers.length === 0) {
      return Response.json({ success: false, error: 'Código de referido no válido' });
    }

    const referrer = referrers[0];
    if (referrer.id === business_id) {
      return Response.json({ success: false, error: 'No puedes usar tu propio código de referido' });
    }
    if (currentBusiness.referred_by) {
      return Response.json({ success: false, error: 'Este negocio ya tiene un referido aplicado' });
    }

    await Promise.all([
      base44.asServiceRole.entities.Business.update(business_id, {
        referred_by: referrer.id,
        referral_bonus_days: (currentBusiness.referral_bonus_days || 0) + BONUS_DAYS,
        trial_end_at: addDays(currentBusiness.trial_end_at, BONUS_DAYS),
      }),
      base44.asServiceRole.entities.Business.update(referrer.id, {
        referral_bonus_days: (referrer.referral_bonus_days || 0) + BONUS_DAYS,
        trial_end_at: addDays(referrer.trial_end_at, BONUS_DAYS),
      }),
    ]);

    return Response.json({ success: true, bonus_days: BONUS_DAYS, referrer_name: referrer.name });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
