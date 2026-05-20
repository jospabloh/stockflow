import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('[DIAGNOSIS] User:', {
      id: user.id,
      email: user.email,
      role: user.role,
      business_id: user.business_id,
      data: user.data
    });

    // Test 1: Try creating category with business_id
    console.log('[TEST 1] Attempting Category.create with business_id...');
    const testPayload = {
      name: 'Test Category ' + Date.now(),
      business_id: user.business_id
    };
    console.log('[TEST 1] Payload:', JSON.stringify(testPayload));
    console.log('[TEST 1] User fields:', {
      'user.business_id': user.business_id,
      'user.role': user.role,
      'user.id': user.id
    });
    
    try {
      const cat = await base44.entities.Category.create(testPayload);
      console.log('[TEST 1 SUCCESS]', cat);
      return Response.json({
        diagnosis: 'CREATE_WORKS',
        user_business_id: user.business_id,
        user_role: user.role,
        category_created: cat.id
      });
    } catch (err1) {
      console.log('[TEST 1 FAILED] Error:', err1.message);
      console.log('[TEST 1 FAILED] Full error:', JSON.stringify(err1, null, 2));
      
      return Response.json({
        diagnosis: 'CREATE_FAILED_WITH_403',
        error_message: err1.message,
        error_type: err1.constructor.name,
        user_role: user.role,
        user_business_id: user.business_id,
        user_object: {
          id: user.id,
          email: user.email,
          role: user.role,
          business_id: user.business_id,
          has_data_object: !!user.data,
          data_keys: user.data ? Object.keys(user.data) : []
        },
        payload_sent: testPayload
      }, { status: 400 });
    }
  } catch (error) {
    console.log('[DIAGNOSIS ERROR]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});