import { getHandler } from './handlers/index.ts';

// v2 (2026-07-05): seguimiento de inscripción — deposit_amount, invoice_status, reason, reason_other, age.
Deno.serve(async (req) => {
  let action = '';
  try {
    const peek = await req.clone().json();
    if (peek && typeof peek.action === 'string') action = peek.action;
  } catch { /* no/invalid body */ }
  const handler = getHandler(action);
  if (!handler) return Response.json({ error: `enrollments: unknown action '${action}'` }, { status: 400 });
  return await handler(req);
});
