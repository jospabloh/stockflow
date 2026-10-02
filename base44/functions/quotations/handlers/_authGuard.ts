/**
 * `base44.auth.me()` THROWS ("Authentication required ...") when the request has no
 * session, and each handler's outer catch turns that into a 500. A missing/invalid
 * session is a 401, not a server error. Applied by entry.ts to the handler's response.
 */
export async function mapAuthErrorTo401(res: Response): Promise<Response> {
  if (res.status !== 500) return res;
  try {
    const body = await res.clone().json();
    if (typeof body?.error === 'string' && /authentication required/i.test(body.error)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch { /* non-JSON body: leave as is */ }
  return res;
}
