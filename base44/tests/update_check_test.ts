// The "Hay una versión nueva" banner decides from these two helpers: it must
// fire only when the served index.html points at a different entry bundle
// than the one this tab loaded, and stay silent when it can't tell.
import { entryBundleFrom, isNewerBuild } from '../../src/lib/updateCheck.js';

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}

Deno.test('reads the hashed entry bundle from a Vite index.html', () => {
  const html = '<head><script type="module" crossorigin src="/assets/index-CzYjyfJK.js"></script></head>';
  eq(entryBundleFrom(html), '/assets/index-CzYjyfJK.js', 'entry');
  eq(entryBundleFrom('<script type="module" src="/src/main.jsx"></script>'), null, 'dev server');
  // Exactly what stockflow.acaciaco.com.mx serves (2026-10-07): src BEFORE type,
  // plus an inline module script with no src. The first parser missed this.
  const served = '<script crossorigin="" src="/assets/index-CzYjyfJK.js" type="module"></script><script type="module">x()</script>';
  eq(entryBundleFrom(served), '/assets/index-CzYjyfJK.js', 'published attribute order');
  eq(entryBundleFrom(''), null, 'empty');
});

Deno.test('a different hash is a newer build; same or unknown is not', () => {
  eq(isNewerBuild('/assets/index-a.js', '/assets/index-b.js'), true, 'changed');
  eq(isNewerBuild('/assets/index-a.js', '/assets/index-a.js'), false, 'same');
  eq(isNewerBuild('/assets/index-a.js', null), false, 'unreadable');
  eq(isNewerBuild(null, '/assets/index-b.js'), false, 'dev tab');
});
