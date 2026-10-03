import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Returns clients, suppliers and payment methods for the authenticated user's business.
 * Uses service role to bypass RLS issues with custom roles (e.g. almacenista).
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = user.business_id;
    if (!businessId) {
      return Response.json({ error: 'No business assigned' }, { status: 400 });
    }

    const [clients, suppliers, paymentMethods] = await Promise.all([
      base44.asServiceRole.entities.Client.filter({ business_id: businessId, status: 'active' }),
      base44.asServiceRole.entities.Supplier.filter({ business_id: businessId }),
      base44.asServiceRole.entities.PaymentMethod.filter({ business_id: businessId, active: true }),
    ]);

    return Response.json({ clients, suppliers, paymentMethods });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}