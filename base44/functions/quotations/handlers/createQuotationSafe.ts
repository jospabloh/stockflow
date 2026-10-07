import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { hasPermission } from './_permissions.ts';
import { validateQuotationCreate } from './_validation.ts';
import { checkCatalogClient, catalogClientName, CATALOG_CLIENT_RULE_KEY } from './_catalogClientRule.ts';
import { getAuthUser } from '../../../shared/authUser.ts';

/**
 * Safe Quotation creation with business_id validation
 * Rejects if:
 * 1. business_id is missing
 * 2. business_id doesn't match user's business_id
 */
export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await getAuthUser(base44);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { folio, client_id, client_name, client_email, client_phone, items, subtotal, tax, total, status, invoice_status, notes, valid_until, payment_method, business_id } = body;

    // VALIDATION: business_id required
    if (!business_id) {
      return Response.json({ 
        success: false, 
        error: 'business_id is required' 
      }, { status: 400 });
    }

    // VALIDATION: business_id must match user's business
    if (business_id !== user.business_id) {
      return Response.json({ 
        success: false, 
        error: `Unauthorized: business_id mismatch (expected: ${user.business_id}, got: ${business_id})` 
      }, { status: 403 });
    }

    // PERMISSION CHECK — the granular key is re-checked server-side (the UI gate alone is bypassable).
    if (!(await hasPermission(base44.asServiceRole, user, 'Cotizaciones', 'create'))) {
      return Response.json({ success: false, error: 'Forbidden: missing permission', permission: 'Cotizaciones:create' }, { status: 403 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    // VALIDATION: required fields / numeric ranges / enum (400 instead of a 500 from the entity layer)
    const validationError = validateQuotationCreate(body);
    if (validationError) {
      return Response.json({ success: false, error: validationError }, { status: 400 });
    }

    // TENANT RULE: catalog-only clients. The stored name comes from the catalog,
    // never from the body, so a valid client_id can't carry a free-typed name.
    const clientCheck = await checkCatalogClient(base44.asServiceRole, user.business_id, client_id);
    if (clientCheck.error) {
      return Response.json({ success: false, error: clientCheck.error, rule: CATALOG_CLIENT_RULE_KEY }, { status: 400 });
    }
    const finalClientName = clientCheck.client ? catalogClientName(clientCheck.client) : client_name;

    // All validations passed, create the quotation — use asServiceRole to allow almacenista to bypass RLS
    const quotation = await base44.asServiceRole.entities.Quotation.create({
      folio,
      client_id,
      client_name: finalClientName,
      client_email,
      client_phone,
      items,
      subtotal,
      tax,
      total,
      status,
      invoice_status,
      notes,
      valid_until,
      payment_method,
      business_id
    });

    return Response.json({ 
      success: true, 
      quotation_id: quotation.id,
      quotation
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}