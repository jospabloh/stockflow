import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { getAuthUser } from '../../../shared/authUser.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);
    if (!user || !user.business_id) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Solo administradores pueden ver estadísticas de referidos' }, { status: 403 });
    }

    const bizList = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const business = bizList[0];
    if (!business) return Response.json({ error: 'Negocio no encontrado' }, { status: 404 });

    let referralCode = business.referral_code;
    if (!referralCode) {
      referralCode = 'REF-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await base44.asServiceRole.entities.Business.update(user.business_id, { referral_code: referralCode });
    }

    const referred = await base44.asServiceRole.entities.Business.filter({ referred_by: user.business_id });
    const converted = referred.filter((b: { billing_status: string }) => b.billing_status === 'active');

    return Response.json({
      referral_code: referralCode,
      total_referrals: referred.length,
      converted_referrals: converted.length,
      bonus_days_earned: business.referral_bonus_days || 0,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
