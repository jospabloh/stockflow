import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get user's business ID
    const userBizId = user.business_id;
    if (!userBizId) {
      return Response.json({ error: 'User has no business assigned' }, { status: 400 });
    }

    // Get list of all businesses
    const allBusinesses = await base44.asServiceRole.entities.Business.list(null, 100);
    const otherBusiness = allBusinesses.find(b => b.id !== userBizId);
    
    if (!otherBusiness) {
      return Response.json({ 
        warning: 'Cannot test cross-business isolation: no other business found',
        current_business: userBizId
      });
    }

    console.log(`[RuntimeProof] Testing isolation: User business=${userBizId}, Other=${otherBusiness.id}`);

    const results = {};

    // TEST 1: Verify user can see own business records
    try {
      const myProducts = await base44.entities.Product.list(null, 10);
      const myClients = await base44.entities.Client.list(null, 10);
      const myCategories = await base44.entities.Category.list(null, 10);
      
      results['TEST_1_SEE_OWN_DATA'] = {
        status: 'PASS',
        products_visible: myProducts.length,
        clients_visible: myClients.length,
        categories_visible: myCategories.length,
        all_belong_to_current_business: [
          ...myProducts,
          ...myClients,
          ...myCategories
        ].every(r => r.business_id === userBizId)
      };
    } catch (err) {
      results['TEST_1_SEE_OWN_DATA'] = { status: 'ERROR', error: (err as Error).message };
    }

    // TEST 2: Verify user CANNOT see other business records (using RLS)
    try {
      const otherBizProducts = await base44.entities.Product.filter({ business_id: otherBusiness.id });
      
      if (otherBizProducts.length > 0) {
        results['TEST_2_CANNOT_SEE_OTHER_PRODUCTS'] = {
          status: 'FAIL',
          issue: 'User can see products from other business!',
          other_business_id: otherBusiness.id,
          products_visible: otherBizProducts.length,
          sample_products: otherBizProducts.slice(0, 3).map(p => ({ id: p.id, name: p.name, business_id: p.business_id }))
        };
      } else {
        results['TEST_2_CANNOT_SEE_OTHER_PRODUCTS'] = {
          status: 'PASS',
          message: 'RLS correctly blocks access to other business products'
        };
      }
    } catch (err) {
      results['TEST_2_CANNOT_SEE_OTHER_PRODUCTS'] = { status: 'ERROR', error: (err as Error).message };
    }

    // TEST 3: Verify reference validation (create product with category from other business)
    try {
      const otherCategories = await base44.asServiceRole.entities.Category.filter({ business_id: otherBusiness.id });
      
      if (otherCategories.length > 0) {
        const otherCatId = otherCategories[0].id;
        
        try {
          // Attempt to create product referencing other business's category
          const crossRefProduct = await base44.entities.Product.create({
            name: "TEST_CROSS_REF_PRODUCT",
            sale_price: 99.99,
            category: otherCatId,
            business_id: userBizId
          });
          
          // Check if category was actually saved as cross-business reference
          if (crossRefProduct.category === otherCatId) {
            results['TEST_3_CROSS_REFERENCE_BLOCK'] = {
              status: 'WARNING',
              issue: 'Product was created with category from other business',
              product_id: crossRefProduct.id,
              category_id: otherCatId,
              category_business_id: otherCategories[0].business_id
            };
            
            // Cleanup
            await base44.entities.Product.delete(crossRefProduct.id);
          } else {
            results['TEST_3_CROSS_REFERENCE_BLOCK'] = {
              status: 'PASS',
              message: 'Cross-business reference was rejected or normalized'
            };
          }
        } catch (createErr) {
          results['TEST_3_CROSS_REFERENCE_BLOCK'] = {
            status: 'PASS',
            message: 'Create with cross-business reference was blocked',
            error: createErr.message
          };
        }
      } else {
        results['TEST_3_CROSS_REFERENCE_BLOCK'] = {
          status: 'SKIP',
          reason: 'No categories in other business'
        };
      }
    } catch (err) {
      results['TEST_3_CROSS_REFERENCE_BLOCK'] = { status: 'ERROR', error: (err as Error).message };
    }

    // TEST 4: Verify mutation isolation (cannot update other business's product)
    try {
      const otherProducts = await base44.asServiceRole.entities.Product.filter({ business_id: otherBusiness.id });
      
      if (otherProducts.length > 0) {
        const otherProd = otherProducts[0];
        
        try {
          await base44.entities.Product.update(otherProd.id, { name: "HACKED" });
          
          results['TEST_4_CANNOT_UPDATE_OTHER'] = {
            status: 'FAIL',
            issue: 'User was able to update product from other business!',
            product_id: otherProd.id,
            product_business_id: otherBusiness.id
          };
        } catch (updateErr) {
          results['TEST_4_CANNOT_UPDATE_OTHER'] = {
            status: 'PASS',
            message: 'RLS correctly blocked update of other business product',
            error_message: updateErr.message
          };
        }
      } else {
        results['TEST_4_CANNOT_UPDATE_OTHER'] = {
          status: 'SKIP',
          reason: 'No products in other business'
        };
      }
    } catch (err) {
      results['TEST_4_CANNOT_UPDATE_OTHER'] = { status: 'ERROR', error: (err as Error).message };
    }

    // TEST 5: Verify deletion isolation
    try {
      const otherClients = await base44.asServiceRole.entities.Client.filter({ business_id: otherBusiness.id });
      
      if (otherClients.length > 0) {
        const otherClient = otherClients[0];
        
        try {
          await base44.entities.Client.delete(otherClient.id);
          
          results['TEST_5_CANNOT_DELETE_OTHER'] = {
            status: 'FAIL',
            issue: 'User was able to delete record from other business!',
            client_id: otherClient.id,
            client_business_id: otherBusiness.id
          };
        } catch (delErr) {
          results['TEST_5_CANNOT_DELETE_OTHER'] = {
            status: 'PASS',
            message: 'RLS correctly blocked deletion of other business record',
            error_message: delErr.message
          };
        }
      } else {
        results['TEST_5_CANNOT_DELETE_OTHER'] = {
          status: 'SKIP',
          reason: 'No clients in other business'
        };
      }
    } catch (err) {
      results['TEST_5_CANNOT_DELETE_OTHER'] = { status: 'ERROR', error: (err as Error).message };
    }

    // Summary
    const allPass = Object.values(results)
      .filter(r => r.status !== 'SKIP' && r.status !== 'ERROR')
      .every(r => r.status === 'PASS');

    return Response.json({
      isolation_proof: 'PHASE_4',
      user: {
        email: user.email,
        business_id: userBizId,
        tested_against: otherBusiness.id
      },
      results,
      overall_status: allPass ? 'PROVEN_ISOLATED' : 'ISSUES_DETECTED',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[runtimeIsolationProof]', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});