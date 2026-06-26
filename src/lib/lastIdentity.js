// Cosmetic-only memory of the last signed-in user, used solely to render a
// "welcome back / continue as" hint on the login screen when there is no active
// session.
//
// SECURITY: this NEVER stores the access token or anything used for
// authorization. The real session is always the Base44 token + RLS. Having a
// remembered identity does NOT mean the user is authenticated — it only lets us
// greet a returning user and prefill their email. Cleared on logout and on
// "usar otra cuenta".
const KEY = 'acacia_last_identity_v1';

export function rememberIdentity(user) {
  if (typeof globalThis === 'undefined' || !globalThis.localStorage || !user) return;
  try {
    const identity = {
      name: user.full_name || user.name || null,
      email: user.email || null,
      avatar: user.avatar_url || user.picture || user.photo_url || null,
    };
    if (!identity.name && !identity.email) return;
    globalThis.localStorage.setItem(KEY, JSON.stringify(identity));
  } catch { /* storage unavailable — non-fatal */ }
}

export function getRememberedIdentity() {
  if (typeof globalThis === 'undefined' || !globalThis.localStorage) return null;
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    if (!raw) return null;
    const id = JSON.parse(raw);
    return id && (id.name || id.email) ? id : null;
  } catch { return null; }
}

export function clearRememberedIdentity() {
  if (typeof globalThis === 'undefined' || !globalThis.localStorage) return;
  try { globalThis.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
