import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {};

    // Test 1: Create Product WITHOUT business_id
    try {
      const result = await base44.entities.Product.create({
        name: 'Test Product No Business',
        sale_price: 100,
        // DELIBERATELY OMIT business_id
      });
      results.test_1_no_business_id = { success: true, id: result?.id, error: 'RLS FAILED TO REJECT' };
    } catch (err) {
      results.test_1_no_business_id = { success: false, error: (err as Error).message };
    }

    // Test 2: Create Product WITH MISMATCHED business_id
    try {
      const result = await base44.entities.Product.create({
        name: 'Test Product Wrong Business',
        sale_price: 100,
        business_id: 'wrong-business-id-12345', // NOT user's business
      });
      results.test_2_mismatched_business_id = { success: true, id: result?.id, error: 'RLS FAILED TO REJECT' };
    } catch (err) {
      results.test_2_mismatched_business_id = { success: false, error: (err as Error).message };
    }

    // Test 3: Create Client WITHOUT business_id
    try {
      const result = await base44.entities.Client.create({
        name: 'Test Client No Business',
        phone: '5555555555',
        // DELIBERATELY OMIT business_id
      });
      results.test_3_client_no_business_id = { success: true, id: result?.id, error: 'RLS FAILED TO REJECT' };
    } catch (err) {
      results.test_3_client_no_business_id = { success: false, error: (err as Error).message };
    }

    // Test 4: Create Client WITH MISMATCHED business_id
    try {
      const result = await base44.entities.Client.create({
        name: 'Test Client Wrong Business',
        phone: '5555555556',
        business_id: 'wrong-business-xyz', // NOT user's business
      });
      results.test_4_client_mismatched_business_id = { success: true, id: result?.id, error: 'RLS FAILED TO REJECT' };
    } catch (err) {
      results.test_4_client_mismatched_business_id = { success: false, error: (err as Error).message };
    }

    // Test 5: Create Product CORRECT (with user's business_id) — should succeed
    try {
      const result = await base44.entities.Product.create({
        name: 'Test Product Correct Business',
        sale_price: 100,
        business_id: user.business_id, // CORRECT
      });
      results.test_5_product_correct = { success: true, id: result?.id };
      // Clean up: delete it
      if (result?.id) {
        await base44.entities.Product.delete(result.id);
      }
    } catch (err) {
      results.test_5_product_correct = { success: false, error: (err as Error).message };
    }

    return Response.json({
      user_business_id: user.business_id,
      tests: results,
      summary: {
        test_1_rejected: results.test_1_no_business_id?.success === false,
        test_2_rejected: results.test_2_mismatched_business_id?.success === false,
        test_3_rejected: results.test_3_client_no_business_id?.success === false,
        test_4_rejected: results.test_4_client_mismatched_business_id?.success === false,
        test_5_succeeded: results.test_5_product_correct?.success === true,
      }
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});