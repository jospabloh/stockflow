import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * FIX KARLA'S BUSINESS ASSIGNMENT
 * If Karla's business_id is wrong in the database, this corrects it.
 * 
 * This function is admin-only and can reassign a user to the correct business.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { target_email, target_business_id } = body;

    if (!target_email || !target_business_id) {
      return Response.json({
        error: 'Missing target_email or target_business_id in request body'
      }, { status: 400 });
    }

    const result = {
      target_email,
      target_business_id,
      action: 'reassign',
      before: null,
      after: null,
      success: false
    };

    try {
      // Find the target user
      const targetUsers = await base44.asServiceRole.entities.User.filter({
        email: target_email
      });

      if (targetUsers.length === 0) {
        return Response.json({
          error: `User not found: ${target_email}`
        }, { status: 404 });
      }

      const targetUser = targetUsers[0];
      result.before = {
        id: targetUser.id,
        email: targetUser.email,
        business_id: targetUser.business_id
      };

      // Verify target business exists
      const targetBusinesses = await base44.asServiceRole.entities.Business.filter({
        id: target_business_id
      });

      if (targetBusinesses.length === 0) {
        return Response.json({
          error: `Business not found: ${target_business_id}`
        }, { status: 404 });
      }

      const targetBusiness = targetBusinesses[0];

      // Update the user's business_id
      await base44.asServiceRole.entities.User.update(targetUser.id, {
        business_id: target_business_id
      });

      result.after = {
        id: targetUser.id,
        email: targetUser.email,
        business_id: target_business_id,
        business_name: targetBusiness.name
      };

      result.success = true;
      result.message = `✓ ${target_email} reassigned to "${targetBusiness.name}"`;

      console.log(`[FIX-KARLA] ✓ Reassigned ${target_email} from ${result.before.business_id} to ${target_business_id}`);

      return Response.json(result);

    } catch (e) {
      result.error = (e as Error).message;
      console.log(`[FIX-KARLA] ✗ ERROR: ${(e as Error).message}`);
      return Response.json(result, { status: 500 });
    }

  } catch (error) {
    console.log(`[FIX-KARLA] FATAL ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});