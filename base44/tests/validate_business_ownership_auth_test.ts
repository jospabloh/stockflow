// validateBusinessOwnership without a session must answer 401, not 500
// (the generic catch used to swallow the auth failure).
import { handle } from '../functions/business/handlers/validateBusinessOwnership.ts';

Deno.test('no session -> 401, not 500', async () => {
  const req = new Request('http://localhost/functions/business', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'validateBusinessOwnership' }),
  });
  const res = await handle(req);
  const body = await res.json();
  if (res.status !== 401) throw new Error(`status ${res.status}, want 401 (${JSON.stringify(body)})`);
});
