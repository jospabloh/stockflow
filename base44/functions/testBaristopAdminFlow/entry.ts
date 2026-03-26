import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TEST BARISTOP ADMIN FLOW
 * Comprehensive test for Karla/Roseta (Baristop admins)
 * - Validate Client required fields (name, phone)
 * - Create Client with valid data
 * - Create Product with success confirmation
 * - Create Supplier with success confirmation
 * - Verify data persists in correct business
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
        client_validation: null,
        client_create: null,
        product_create: null,
        supplier_create: null,
        data_persistence: null,
      },
      issues: []
    };

    // TEST 1: Client validation (missing name)
    try {
      await base44.entities.Client.create({
        business_id: businessId,
        phone: "5551234567"
        // Missing name - should fail backend RLS
      });
      result.issues.push("CLIENT VALIDATION: Missing name was accepted (should fail)");
      result.tests.client_validation = { success: false, issue: "Missing name accepted" };
    } catch (e) {
      // Expected: RLS should catch missing required field or backend validation
      result.tests.client_validation = { success: true, rejected_missing_name: true };
    }

    // TEST 2: Client validation (missing phone)
    try {
      await base44.entities.Client.create({
        business_id: businessId,
        name: `TEST_CLIENT_NO_PHONE_${timestamp}`
      });
      result.issues.push("CLIENT VALIDATION: Missing phone was accepted (should fail)");
      result.tests.client_validation = { success: false, issue: "Missing phone accepted" };
    } catch (e) {
      // Expected
      if (!result.tests.client_validation) {
        result.tests.client_validation = { success: true, rejected_missing_phone: true };
      }
    }

    // TEST 3: Create Client with valid data
    let createdClientId;
    try {
      const client = await base44.entities.Client.create({
        business_id: businessId,
        name: `TEST_CLIENT_${timestamp}`,
        phone: "5551234567",
        email: `test${timestamp}@example.com`,
        status: "active"
      });
      createdClientId = client.id;
      result.tests.client_create = {
        success: true,
        client_id: client.id,
        business_id: client.business_id,
        correct_business: client.business_id === businessId
      };
      if (client.business_id !== businessId) {
        result.issues.push(`CLIENT CREATE: Saved to wrong business! Expected ${businessId}, got ${client.business_id}`);
      }
    } catch (e) {
      result.tests.client_create = { success: false, error: e.message };
      result.issues.push(`CLIENT CREATE: ${e.message}`);
    }

    // TEST 4: Create Product with valid data
    try {
      const product = await base44.entities.Product.create({
        business_id: businessId,
        name: `TEST_PRODUCT_${timestamp}`,
        sale_price: 99.99,
        purchase_price: 50.00,
        sku: `TST-${timestamp}`,
        stock: 10,
        min_stock: 5,
        status: "active"
      });
      result.tests.product_create = {
        success: true,
        product_id: product.id,
        business_id: product.business_id,
        correct_business: product.business_id === businessId
      };
      if (product.business_id !== businessId) {
        result.issues.push(`PRODUCT CREATE: Saved to wrong business! Expected ${businessId}, got ${product.business_id}`);
      }
    } catch (e) {
      result.tests.product_create = { success: false, error: e.message };
      result.issues.push(`PRODUCT CREATE: ${e.message}`);
    }

    // TEST 5: Create Supplier with valid data
    try {
      const supplier = await base44.entities.Supplier.create({
        business_id: businessId,
        name: `TEST_SUPPLIER_${timestamp}`,
        contact_name: `Contact ${timestamp}`,
        email: `supplier${timestamp}@example.com`,
        phone: "5555555555"
      });
      result.tests.supplier_create = {
        success: true,
        supplier_id: supplier.id,
        business_id: supplier.business_id,
        correct_business: supplier.business_id === businessId
      };
      if (supplier.business_id !== businessId) {
        result.issues.push(`SUPPLIER CREATE: Saved to wrong business! Expected ${businessId}, got ${supplier.business_id}`);
      }
    } catch (e) {
      result.tests.supplier_create = { success: false, error: e.message };
      result.issues.push(`SUPPLIER CREATE: ${e.message}`);
    }

    // TEST 6: Verify data persistence
    try {
      const clients = await base44.entities.Client.filter({ business_id: businessId });
      const products = await base44.entities.Product.filter({ business_id: businessId });
      const suppliers = await base44.entities.Supplier.filter({ business_id: businessId });

      const clientFound = clients.some(c => c.name === `TEST_CLIENT_${timestamp}`);
      const productFound = products.some(p => p.name === `TEST_PRODUCT_${timestamp}`);
      const supplierFound = suppliers.some(s => s.name === `TEST_SUPPLIER_${timestamp}`);

      result.tests.data_persistence = {
        success: clientFound && productFound && supplierFound,
        client_found: clientFound,
        product_found: productFound,
        supplier_found: supplierFound
      };

      if (!clientFound) result.issues.push("DATA PERSISTENCE: Client not found after creation");
      if (!productFound) result.issues.push("DATA PERSISTENCE: Product not found after creation");
      if (!supplierFound) result.issues.push("DATA PERSISTENCE: Supplier not found after creation");
    } catch (e) {
      result.tests.data_persistence = { success: false, error: e.message };
      result.issues.push(`DATA PERSISTENCE: ${e.message}`);
    }

    // Overall status
    const allTestsPassed = Object.values(result.tests).every(t => t?.success !== false);
    result.status = allTestsPassed && result.issues.length === 0 ? "PASSED" : "FAILED";

    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});