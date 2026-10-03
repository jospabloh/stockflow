import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';
import { getAuthUser } from '../../../shared/authUser.ts';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { enrollment_id } = body;

    if (!enrollment_id) {
      return Response.json({ error: 'enrollment_id is required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.Enrollment.filter({ id: enrollment_id });
    if (records.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const record = records[0];

    if (record.business_id !== user.business_id) {
      console.error(
        `[deleteEnrollmentSafe] CROSS-TENANT ATTEMPT: user ${user.email} (business ${user.business_id}) ` +
        `tried to delete enrollment ${enrollment_id} (business ${record.business_id})`
      );
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    await base44.asServiceRole.entities.Enrollment.delete(enrollment_id);

    return Response.json({ success: true, enrollment_id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
