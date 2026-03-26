import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // PHASE 1: Audit all business-owned entities for isolation
    const audit = {};
    const entities = [
      'Client', 'Product', 'Supplier', 'Category', 'Quotation', 'Movement', 
      'PettyCashMovement', 'AppSettings'
    ];

    for (const entityName of entities) {
      audit[entityName] = {
        read_isolated: 'UNKNOWN',
        create_isolated: 'UNKNOWN',
        update_isolated: 'UNKNOWN',
        delete_isolated: 'UNKNOWN',
        relation_isolated: 'UNKNOWN',
        root_cause: null,
        risk_level: 'HIGH',
        details: {}
      };

      try {
        // Test READ isolation
        const schema = await base44.entities[entityName].schema();
        const hasRLS = schema.rls !== undefined;
        const readRLS = schema.rls?.read !== undefined;
        
        audit[entityName].details.schema_has_rls = hasRLS;
        audit[entityName].details.read_rls_defined = readRLS;
        
        if (!hasRLS) {
          audit[entityName].read_isolated = 'OPEN';
          audit[entityName].root_cause = 'No RLS defined';
          audit[entityName].risk_level = 'CRITICAL';
        } else if (!readRLS) {
          audit[entityName].read_isolated = 'OPEN';
          audit[entityName].root_cause = 'READ RLS not defined';
          audit[entityName].risk_level = 'CRITICAL';
        } else {
          audit[entityName].read_isolated = 'FIXED';
        }

        // Test CREATE isolation - check if RLS requires business_id
        const createRLS = schema.rls?.create !== undefined;
        if (!createRLS) {
          audit[entityName].create_isolated = 'OPEN';
          if (!audit[entityName].root_cause) {
            audit[entityName].root_cause = 'CREATE RLS not defined';
          }
          audit[entityName].risk_level = 'CRITICAL';
        } else {
          audit[entityName].create_isolated = 'FIXED';
        }

        // Test UPDATE/DELETE isolation
        const updateRLS = schema.rls?.update !== undefined;
        const deleteRLS = schema.rls?.delete !== undefined;
        
        if (!updateRLS) {
          audit[entityName].update_isolated = 'OPEN';
          audit[entityName].risk_level = 'CRITICAL';
        } else {
          audit[entityName].update_isolated = 'FIXED';
        }

        if (!deleteRLS) {
          audit[entityName].delete_isolated = 'OPEN';
          audit[entityName].risk_level = 'CRITICAL';
        } else {
          audit[entityName].delete_isolated = 'FIXED';
        }

      } catch (err) {
        audit[entityName].details.error = err.message;
        audit[entityName].risk_level = 'CRITICAL';
      }
    }

    // PHASE 3: Check for contamination - sample records from each entity
    const contamination = {};
    
    for (const entityName of entities) {
      try {
        // Use service role to see ALL records across all businesses
        const allRecords = await base44.asServiceRole.entities[entityName].list(null, 100);
        const currentBusinessRecords = await base44.entities[entityName].list(null, 100);
        
        contamination[entityName] = {
          total_records_all_businesses: allRecords.length,
          records_visible_to_current_user: currentBusinessRecords.length,
          records_without_business_id: allRecords.filter(r => !r.business_id).length,
          sample_cross_business: []
        };

        // Check if user can see records from OTHER businesses
        if (currentBusinessRecords.length > 0) {
          const firstRecord = currentBusinessRecords[0];
          if (firstRecord.business_id !== user.business_id) {
            contamination[entityName].sample_cross_business.push({
              record_id: firstRecord.id,
              record_business_id: firstRecord.business_id,
              current_user_business_id: user.business_id,
              issue: 'USER CAN SEE OTHER BUSINESS RECORDS'
            });
          }
        }
      } catch (err) {
        contamination[entityName] = { error: err.message };
      }
    }

    return Response.json({
      phase: '1_and_3',
      audit_status: audit,
      contamination_check: contamination,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[auditMultiTenantIsolation]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});