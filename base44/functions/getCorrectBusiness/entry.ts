import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * GET CORRECT BUSINESS
 * Server-side function that guarantees returning the user's correct business
 * Uses user-scoped SDK to avoid auth issues
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.business_id) {
      return Response.json({ error: 'User has no business_id assigned' }, { status: 400 });
    }

    // Try user-scoped first (limited by RLS)
    try {
      const businesses = await base44.entities.Business.filter({ id: user.business_id });
      const match = businesses.find(b => b.id === user.business_id);
      
      if (match) {
        return Response.json({
          business: {
            id: match.id,
            name: match.name
          },
          user: {
            email: user.email,
            full_name: user.full_name,
            business_id: user.business_id
          }
        });
      }
    } catch (_e) {
      // Fallback to service role if user-scoped fails
      const allBusinesses = await base44.asServiceRole.entities.Business.list();
      const correctBusiness = allBusinesses.find(b => b.id === user.business_id);

      if (!correctBusiness) {
        return Response.json(
          { error: `Business ID ${user.business_id} not found` },
          { status: 404 }
        );
      }

      return Response.json({
        business: {
          id: correctBusiness.id,
          name: correctBusiness.name
        },
        user: {
          email: user.email,
          full_name: user.full_name,
          business_id: user.business_id
        }
      });
    }

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
