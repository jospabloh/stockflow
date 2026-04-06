import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the current version from environment or code
    const currentVersion = "2.4.1";
    const currentDate = "2026-04-06";

    // Get existing AppVersion records
    const versions = await base44.asServiceRole.entities.AppVersion.list();
    
    if (versions.length > 0) {
      // Update the first (and should be only) record
      const version = versions[0];
      await base44.asServiceRole.entities.AppVersion.update(version.id, {
        version: currentVersion,
        released_at: new Date().toISOString(),
        release_notes: "Función de corrección de cotizaciones: nueva función backend checkAndFixQuotation para anular o eliminar cotizaciones erradas"
      });
      
      return Response.json({ 
        success: true, 
        message: `Updated AppVersion to ${currentVersion}`,
        updated: true 
      });
    } else {
      // Create new record if none exists
      await base44.asServiceRole.entities.AppVersion.create({
        version: currentVersion,
        released_at: new Date().toISOString(),
        release_notes: "Función de corrección de cotizaciones"
      });

      return Response.json({ 
        success: true, 
        message: `Created AppVersion ${currentVersion}`,
        created: true 
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});