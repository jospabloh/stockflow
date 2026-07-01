import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();

    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const members = await base44.asServiceRole.entities.User.filter({
      business_id: caller.business_id,
    });

    return Response.json({
      success: true,
      members: members.map(u => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
      })),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}