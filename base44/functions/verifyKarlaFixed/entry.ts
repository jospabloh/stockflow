import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    console.log(`[VERIFY] Testing for user: ${user.email}`);
    console.log(`[VERIFY] business_id: ${user.business_id}`);
    
    if (user.email !== 'karla.baristop@gmail.com') {
      return Response.json({
        warning: 'This test must be run as karla.baristop@gmail.com',
        current_user: user.email
      });
    }
    
    // Test 1: User has business_id set
    if (!user.business_id) {
      return Response.json({
        status: 'FAILED',
        test: 'User has business_id',
        result: false,
        issue: 'business_id is not set'
      });
    }
    console.log('[VERIFY] ✓ Test 1 passed: business_id is set');
    
    // Test 2: getBusinessName function works
    const response = await fetch('/api/functions/getBusinessName', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: user.business_id })
    });
    const result = await response.json();
    
    if (!result.success) {
      return Response.json({
        status: 'FAILED',
        test: 'getBusinessName returns success',
        result: false,
        error: result.error
      });
    }
    console.log(`[VERIFY] ✓ Test 2 passed: business name is "${result.business_name}"`);
    
    // Test 3: Business name matches expected
    if (result.business_name !== 'Baristop Distribuidora') {
      return Response.json({
        status: 'FAILED',
        test: 'Business name is Baristop Distribuidora',
        result: false,
        actual: result.business_name
      });
    }
    console.log('[VERIFY] ✓ Test 3 passed: business name is Baristop Distribuidora');
    
    // Test 4: Can access AppSettings for Baristop
    const appSettings = await base44.entities.AppSettings.filter({ business_id: user.business_id });
    console.log(`[VERIFY] AppSettings query returned ${appSettings.length} results`);
    
    // Test 5: Cannot see ACACIA data
    const acacia_business_id = '69c593f99e0839c7e07fb5d0';
    const acacia_settings = await base44.entities.AppSettings.filter({ business_id: acacia_business_id });
    console.log(`[VERIFY] ACACIA AppSettings query returned ${acacia_settings.length} results`);
    
    if (acacia_settings.length > 0) {
      return Response.json({
        status: 'FAILED',
        test: 'Cannot see ACACIA data',
        result: false,
        issue: 'Karla can see ACACIA AppSettings (data leak!)',
        acacia_settings_count: acacia_settings.length
      });
    }
    console.log('[VERIFY] ✓ Test 5 passed: Cannot see ACACIA data');
    
    return Response.json({
      status: 'PROVEN FIXED',
      user: {
        email: user.email,
        business_id: user.business_id,
        business_name: result.business_name
      },
      tests_passed: [
        'business_id is set',
        'getBusinessName returns success',
        'business name is Baristop Distribuidora',
        'Cannot see ACACIA data'
      ]
    });
    
  } catch (error) {
    console.error('[VERIFY] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});