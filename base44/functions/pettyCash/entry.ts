import { getHandler } from './handlers/index.ts';
import { mapAuthErrorTo401 } from './handlers/_authGuard.ts';

Deno.serve(async (req) => {
  let action = '';
  try {
    const peek = await req.clone().json();
    if (peek && typeof peek.action === 'string') action = peek.action;
  } catch { /* no/invalid body */ }
  const handler = getHandler(action);
  if (!handler) return Response.json({ error: `pettyCash: unknown action '${action}'` }, { status: 400 });
  return await mapAuthErrorTo401(await handler(req));
});
