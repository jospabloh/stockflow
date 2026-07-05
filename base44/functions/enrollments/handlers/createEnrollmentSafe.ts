import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      business_id, course_id, contact_id,
      status, price_option_label, price_amount, people_count, amount_paid, payment_method, notes,
      deposit_amount, invoice_status, reason, reason_other, age
    } = body;

    if (!business_id) {
      return Response.json({ success: false, error: 'business_id is required' }, { status: 400 });
    }
    if (business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Unauthorized: business_id mismatch' }, { status: 403 });
    }
    if (!course_id || !contact_id) {
      return Response.json({ success: false, error: 'Curso y contacto son requeridos' }, { status: 400 });
    }

    // Fetch course & contact via service role, and validate both belong to the tenant.
    const courseArr = await base44.asServiceRole.entities.Course.filter({ id: course_id });
    const course = courseArr[0];
    if (!course || course.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Curso no encontrado' }, { status: 404 });
    }
    const contactArr = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
    const contact = contactArr[0];
    if (!contact || contact.business_id !== user.business_id) {
      return Response.json({ success: false, error: 'Contacto no encontrado' }, { status: 404 });
    }

    // LICENSE CHECK
    const bizArr = await base44.asServiceRole.entities.Business.filter({ id: user.business_id });
    const biz = bizArr[0];
    const billingStatus = biz?.billing_status || 'active';
    if (billingStatus === 'view_only' || billingStatus === 'suspended') {
      return Response.json({ success: false, error: 'write_blocked', billing_status: billingStatus }, { status: 403 });
    }

    const enrollment = await base44.entities.Enrollment.create({
      business_id,
      course_id,
      course_title: course.title || "",
      contact_id,
      contact_name: contact.name || "",
      contact_phone: contact.phone || "",
      contact_email: contact.email || "",
      status: status || "interesado",
      price_option_label: price_option_label || "",
      price_amount: typeof price_amount === 'number' ? price_amount : null,
      people_count: typeof people_count === 'number' && people_count > 0 ? people_count : 1,
      amount_paid: typeof amount_paid === 'number' ? amount_paid : 0,
      payment_method: payment_method || "",
      deposit_amount: typeof deposit_amount === 'number' ? deposit_amount : 0,
      invoice_status: invoice_status || "no_requiere",
      reason: reason || "",
      reason_other: reason_other || "",
      age: typeof age === 'number' ? age : null,
      notes: notes || ""
    });

    return Response.json({ success: true, enrollment_id: enrollment.id, enrollment });
  } catch (error) {
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
