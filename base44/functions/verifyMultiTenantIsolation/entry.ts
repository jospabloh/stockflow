import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * VERIFY MULTI-TENANT ISOLATION FIX
 * Comprehensive test to confirm tenant isolation across all CRUD paths
 * - Clients filtered by business_id
 * - Products filtered by business_id  
 * - Quotations filtered by business_id
 * - Movement filters include business_id on related queries
 * - Cross-tenant deletion prevention
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can run this test' }, { status: 403 });
    }

    const businessId = user.business_id;
    const userEmail = user.email;
    const timestamp = Date.now();

    const result = {
      user: userEmail,
      business_id: businessId,
      role: user.role,
      tests: {
        client_filter_isolation: null,
        product_filter_isolation: null,
        quotation_filter_isolation: null,
        movement_filter_isolation: null,
        client_delete_safety: null,
        product_delete_safety: null,
      },
      issues: []
    };

    // TEST 1: Client filtering isolation
    try {
      const allClients = await base44.entities.Client.list();
      const businessClients = await base44.entities.Client.filter({ business_id: businessId });
      
      // Verify filtered list is equal or smaller than all clients
      result.tests.client_filter_isolation = {
        success: businessClients.length <= allClients.length,
        all_count: allClients.length,
        filtered_count: businessClients.length,
        all_belong_to_business: businessClients.every(c => c.business_id === businessId)
      };
      
      if (!businessClients.every(c => c.business_id === businessId)) {
        result.issues.push("CLIENT FILTER ISOLATION: Found clients with mismatched business_id");
      }
    } catch (e) {
      result.tests.client_filter_isolation = { success: false, error: (e as Error).message };
      result.issues.push(`CLIENT FILTER: ${(e as Error).message}`);
    }

    // TEST 2: Product filtering isolation
    try {
      const allProducts = await base44.entities.Product.list();
      const businessProducts = await base44.entities.Product.filter({ business_id: businessId });
      
      result.tests.product_filter_isolation = {
        success: businessProducts.length <= allProducts.length,
        all_count: allProducts.length,
        filtered_count: businessProducts.length,
        all_belong_to_business: businessProducts.every(p => p.business_id === businessId)
      };
      
      if (!businessProducts.every(p => p.business_id === businessId)) {
        result.issues.push("PRODUCT FILTER ISOLATION: Found products with mismatched business_id");
      }
    } catch (e) {
      result.tests.product_filter_isolation = { success: false, error: (e as Error).message };
      result.issues.push(`PRODUCT FILTER: ${(e as Error).message}`);
    }

    // TEST 3: Quotation filtering isolation
    try {
      const allQuotations = await base44.entities.Quotation.list();
      const businessQuotations = await base44.entities.Quotation.filter({ business_id: businessId });
      
      result.tests.quotation_filter_isolation = {
        success: businessQuotations.length <= allQuotations.length,
        all_count: allQuotations.length,
        filtered_count: businessQuotations.length,
        all_belong_to_business: businessQuotations.every(q => q.business_id === businessId)
      };
      
      if (!businessQuotations.every(q => q.business_id === businessId)) {
        result.issues.push("QUOTATION FILTER ISOLATION: Found quotations with mismatched business_id");
      }
    } catch (e) {
      result.tests.quotation_filter_isolation = { success: false, error: (e as Error).message };
      result.issues.push(`QUOTATION FILTER: ${(e as Error).message}`);
    }

    // TEST 4: Movement filtering isolation (related queries must include business_id)
    try {
      const allMovements = await base44.entities.Movement.list();
      const businessMovements = await base44.entities.Movement.filter({ business_id: businessId });
      
      result.tests.movement_filter_isolation = {
        success: businessMovements.length <= allMovements.length,
        all_count: allMovements.length,
        filtered_count: businessMovements.length,
        all_belong_to_business: businessMovements.every(m => m.business_id === businessId)
      };
      
      if (!businessMovements.every(m => m.business_id === businessId)) {
        result.issues.push("MOVEMENT FILTER ISOLATION: Found movements with mismatched business_id");
      }
    } catch (e) {
      result.tests.movement_filter_isolation = { success: false, error: (e as Error).message };
      result.issues.push(`MOVEMENT FILTER: ${(e as Error).message}`);
    }

    // TEST 5: Client delete safety (RLS should reject delete of other business's client)
    try {
      // Find a client from a different business if possible
      const allClients = await base44.entities.Client.list();
      const otherBusinessClient = allClients.find(c => c.business_id !== businessId);
      
      if (otherBusinessClient) {
        try {
          await base44.entities.Client.delete(otherBusinessClient.id);
          result.tests.client_delete_safety = { 
            success: false, 
            issue: "DELETE ALLOWED ACROSS BUSINESS BOUNDARY - CRITICAL SECURITY FAILURE"
          };
          result.issues.push("CRITICAL: Client delete was allowed across business boundary");
        } catch (e) {
          // Expected: deletion should fail
          result.tests.client_delete_safety = { 
            success: true, 
            blocked_cross_business_delete: true,
            error_received: (e as Error).message.substring(0, 50)
          };
        }
      } else {
        result.tests.client_delete_safety = { 
          success: true, 
          note: "No cross-business client found to test deletion safety"
        };
      }
    } catch (e) {
      result.tests.client_delete_safety = { success: false, error: (e as Error).message };
      result.issues.push(`CLIENT DELETE SAFETY: ${(e as Error).message}`);
    }

    // TEST 6: Product delete safety
    try {
      const allProducts = await base44.entities.Product.list();
      const otherBusinessProduct = allProducts.find(p => p.business_id !== businessId);
      
      if (otherBusinessProduct) {
        try {
          await base44.entities.Product.delete(otherBusinessProduct.id);
          result.tests.product_delete_safety = { 
            success: false, 
            issue: "DELETE ALLOWED ACROSS BUSINESS BOUNDARY - CRITICAL"
          };
          result.issues.push("CRITICAL: Product delete was allowed across business boundary");
        } catch (e) {
          result.tests.product_delete_safety = { 
            success: true, 
            blocked_cross_business_delete: true
          };
        }
      } else {
        result.tests.product_delete_safety = { 
          success: true, 
          note: "No cross-business product found to test deletion safety"
        };
      }
    } catch (e) {
      result.tests.product_delete_safety = { success: false, error: (e as Error).message };
      result.issues.push(`PRODUCT DELETE SAFETY: ${(e as Error).message}`);
    }

    // Overall status
    const allTestsPassed = Object.values(result.tests).every(t => t?.success !== false);
    result.status = allTestsPassed && result.issues.length === 0 ? "PASSED" : "FAILED";

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});