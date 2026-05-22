import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');

    console.log("[TRACE] Starting Karla BusinessSetup trace...");

    // Get Karla's user record
    const karla = await base44.auth.me();
    if (!karla) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!PLATFORM_OWNER_EMAIL || karla.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });
    }
    console.log(`[TRACE] Karla user: email=${karla.email}, business_id=${karla.business_id}, role=${karla.role}`);
    
    if (!karla.business_id) {
      console.log("[TRACE] ✓ Karla has NO business_id - this is EXPECTED for join flow");
      return Response.json({
        status: "EXPECTED",
        message: "Karla has no business_id, ready for BusinessSetup",
        karla: {
          email: karla.email,
          business_id: karla.business_id,
          role: karla.role,
        }
      });
    }
    
    // If she DOES have a business_id, check if it's valid
    console.log(`[TRACE] Karla HAS business_id: ${karla.business_id}`);
    
    // Try to load that business
    const businesses = await base44.entities.Business.filter({ id: karla.business_id });
    console.log(`[TRACE] Business.filter({id: ${karla.business_id}}) returned ${businesses.length} results`);
    
    if (businesses.length === 0) {
      console.log("[TRACE] ✗ PROBLEM: business_id set but Business record not found!");
      return Response.json({
        status: "PROBLEM",
        issue: "business_id_set_but_no_record",
        message: "Karla has business_id but Business record doesn't exist or isn't accessible",
        karla: {
          email: karla.email,
          business_id: karla.business_id,
          role: karla.role,
        },
        businesses_found: 0
      });
    }
    
    const exactMatch = businesses.find(b => b.id === karla.business_id);
    if (exactMatch) {
      console.log(`[TRACE] ✓ Business found and matches: ${exactMatch.name}`);
      
      // Check if AppSettings loads
      const appSettings = await base44.entities.AppSettings.filter({ business_id: karla.business_id });
      console.log(`[TRACE] AppSettings.filter({business_id: ${karla.business_id}}) returned ${appSettings.length} results`);
      
      return Response.json({
        status: "WORKING",
        message: "Karla's business assignment is correct and accessible",
        karla: {
          email: karla.email,
          business_id: karla.business_id,
          role: karla.role,
        },
        business: {
          id: exactMatch.id,
          name: exactMatch.name,
        },
        appSettings_found: appSettings.length,
      });
    } else {
      console.log(`[TRACE] ✗ PROBLEM: business_id doesn't match any returned record!`);
      console.log(`[TRACE] Looking for: ${karla.business_id}`);
      console.log(`[TRACE] Found: ${businesses.map(b => b.id).join(', ')}`);
      
      return Response.json({
        status: "PROBLEM",
        issue: "business_id_mismatch",
        message: "business_id doesn't match any returned record - RLS filter bug?",
        karla: {
          email: karla.email,
          business_id: karla.business_id,
          role: karla.role,
        },
        businesses_found: businesses.length,
        business_ids: businesses.map(b => b.id)
      });
    }
    
  } catch (error) {
    console.error("[TRACE] Error:", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});