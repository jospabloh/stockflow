// Pure helpers for AppUpdateBanner (module 21), kept out of the component file
// so react-refresh stays happy and a test can import them with no DOM.
export const ENTRY_RE = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

/** Entry bundle path (e.g. /assets/index-abc123.js) in an HTML string, or null.
 *  Attribute order is not fixed: the published site serves
 *  `<script crossorigin src="…" type="module">`, src before type. */
export function entryBundleFrom(html) {
  for (const [tag] of (html ?? '').matchAll(/<script\b[^>]*>/gi)) {
    if (!/\btype=["']module["']/i.test(tag)) continue;
    const src = /\bsrc=["']([^"']+)["']/i.exec(tag);
    const found = src && src[1].match(ENTRY_RE);
    if (found) return found[0];
  }
  return null;
}

/** True when `latest` is a real bundle path that differs from the running one. */
export function isNewerBuild(running, latest) {
  return Boolean(running && latest && running !== latest);
}
