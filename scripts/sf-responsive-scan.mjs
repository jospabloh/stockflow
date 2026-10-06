// Layout scan: overlapping controls, horizontal overflow and clipped button
// text on StockFlow's main screens, at phone / tablet / desktop widths,
// measured in Chromium.
//
// Usage:  node scripts/sf-responsive-scan.mjs [--width 320,390,768,834,1024,1440]
//                                              [--shots dir] [--only Products,Settings]
//   Builds the app and serves it with `vite preview` itself and fulfils EVERY /api/ request locally
//   (mocked backend): nothing reaches Base44. Exits 1 when it finds a problem.
//   Needs a Playwright Chromium (CHROMIUM_PATH overrides the executable).
//
// What it reports, per screen and width:
//   OVERLAP  two interactive elements (or one plus a fixed floating control)
//            whose boxes intersect and neither contains the other
//   OVERFLOW the page scrolls sideways, or an element pokes out of the viewport
//   CLIPPED  a button/link whose own text is wider than its box
import { build, preview } from 'vite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const WIDTHS = (argOf('--width') || '320,390,768,834,1024,1440').split(',').map(Number);
const SHOTS = argOf('--shots');
const ALL_SHOTS = args.includes('--all-shots'); // also keep a shot of clean screens, for eyeballing
const ONLY = argOf('--only')?.split(',');
// iPad portrait / landscape heights; phones get a tall viewport.
const HEIGHT = { 320: 640, 390: 844, 768: 1024, 834: 1112, 1024: 768, 1440: 900 };

const BIZ = 'biz1';
const C = '2026-09-01T12:00:00.000Z';
const today = new Date().toISOString().slice(0, 10);
const USERS = {
  OWNER: { id: 'u1', email: 'dueno@example.invalid', full_name: 'Dueño de Prueba', role: 'owner', business_id: BIZ },
  ALMACEN: { id: 'u2', email: 'almacen@example.invalid', full_name: 'Almacenista Prueba', role: 'almacenista', business_id: BIZ },
  PLATFORM: { id: 'u3', email: 'plataforma@example.invalid', full_name: 'Plataforma Prueba', role: 'admin', business_id: BIZ },
};
const row = (i, extra) => ({ id: `r${i}`, business_id: BIZ, created_date: C, updated_date: C, created_by: 'dueno@example.invalid', ...extra });
const rows = (n, f) => Array.from({ length: n }, (_, i) => row(i, f(i)));
function fixtures() {
  return {
    Business: [{ id: BIZ, name: 'Negocio de Prueba con un Nombre Largo S.A. de C.V.', billing_status: 'active', status: 'active', license_plan: 'growth', invite_code: 'ABC123' }],
    Category: rows(4, (i) => ({ name: `Categoría ${i + 1}`, color: '#3b82f6', status: 'active' })),
    Supplier: rows(4, (i) => ({ name: `Proveedor con nombre largo ${i + 1}`, contact_name: 'Contacto', phone: '4491234567', email: 'prov@example.invalid', status: 'active' })),
    Client: rows(4, (i) => ({ name: `Cliente con nombre largo ${i + 1}`, phone: '4491234567', email: 'cli@example.invalid', status: 'active' })),
    Product: rows(8, (i) => ({ name: `Producto de ejemplo con nombre largo ${i + 1}`, sku: `SKU-${i}`, stock: i * 3, min_stock: 4, status: 'active', retail_sale_price: 1250.5, cost: 800, category_id: 'r0', unit: 'pza' })),
    Movement: rows(6, (i) => ({ type: ['entry', 'exit', 'adjustment', 'return'][i % 4], product_id: 'r0', product_name: 'Producto de ejemplo', quantity: 5, date: today, reason: 'Motivo de prueba', payment_status: i % 2 ? 'pending' : 'confirmed', total: 1500 })),
    Quotation: rows(5, (i) => ({ folio: `COT-26090${i}-000${i}`, client_name: `Cliente largo ${i}`, status: ['draft', 'sent', 'converted', 'approved'][i % 4], total: 4560.2, date: today, items: [{ product_name: 'Producto', quantity: 2, unit_price: 100 }], paid: false })),
    PaymentMethod: rows(3, (i) => ({ name: ['Efectivo', 'Transferencia', 'Tarjeta'][i], status: 'active' })),
    Rubro: rows(3, (i) => ({ name: `Rubro ${i + 1}`, type: 'expense', status: 'active', active: true })),
    FundAccount: rows(3, (i) => ({ name: `Cuenta ${i + 1}`, type: 'cash', status: 'active', active: true, balance: 1000 })),
    PettyCashMovement: rows(5, (i) => ({ type: i % 2 ? 'income' : 'expense', amount: 350, description: 'Movimiento de prueba', date: today })),
    UtilityMovement: rows(4, (i) => ({ type: 'withdrawal', amount: 500, description: 'Retiro', date: today })),
    SupplierPayment: rows(4, (i) => ({ supplier_name: `Proveedor ${i}`, amount: 2300, due_date: today, status: 'pending', invoice_status: 'pending' })),
    MachinerySale: rows(3, (i) => ({ client_name: `Cliente ${i}`, business_name: 'Negocio', machine_type: 'Molino', sale_price: 50000, cost: 40000, date: today })),
    Course: rows(3, (i) => ({ name: `Curso ${i + 1}`, price: 1200, status: 'active', start_date: today })),
    Enrollment: rows(3, (i) => ({ course_id: 'r0', contact_name: `Contacto ${i}`, status: 'confirmed', date: today })),
    Contact: rows(3, (i) => ({ name: `Contacto ${i}`, email: 'c@example.invalid', phone: '4491234567' })),
    Campaign: rows(2, (i) => ({ name: `Campaña ${i}`, status: 'draft' })),
    AppSettings: [row(0, {})],
    SupportTicket: rows(2, (i) => ({ subject: `Ticket ${i}`, status: 'open', priority: 'normal' })),
  };
}

function matches(r, q) {
  if (!q) return true;
  return Object.entries(q).every(([k, v]) => {
    if (v && typeof v === 'object') return true;
    if (r[k] === undefined) return true;
    return String(r[k]) === String(v);
  });
}

async function mockBackend(ctx, who) {
  const db = fixtures();
  const me = { ...USERS[who] };
  // Nothing leaves the machine: fonts / remote images are answered empty.
  await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (route) => route.fulfill({ status: 204, body: '' }));
  await ctx.route((u) => u.pathname.startsWith('/api/') || /socket\.io/.test(u.href), async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (x, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(x) });
    if (/socket\.io/.test(url.href)) return route.abort();
    if (p.includes('public-settings')) return json({ id: 'mockapp', public_settings: {} });
    if (p.endsWith('/entities/User/me')) return json(me);
    let m = p.match(/\/entities\/(\w+)(?:\/(\w+))?$/);
    if (m) {
      const list = db[m[1]] || [];
      if (req.method() !== 'GET') return json({ id: `mock_${Date.now()}` });
      if (m[2]) return json(list.find((r) => r.id === m[2]) || {});
      let q = {};
      try { q = JSON.parse(url.searchParams.get('q') || '{}'); } catch { /* none */ }
      return json(list.filter((r) => matches(r, q)));
    }
    m = p.match(/\/functions\/(\w+)/);
    if (m) {
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch { /* none */ }
      if (m[1] === 'licenses') return json({ is_platform_admin: who === 'PLATFORM', billing_status: 'active', is_read_only: false, license_plan: 'growth', active_user_count: 2, licensed_user_limit: 5, trial_days_left: null });
      if (m[1] === 'permissions') return json({ profiles: {}, featureEnabled: false, is_platform_admin: who === 'PLATFORM' });
      if (m[1] === 'tenantRules') return json({ ok: true, rules: [], map: {}, items: [] });
      if (m[1] === 'session') return json({ ok: true, session_id: 's1', status: 'active' });
      if (body.action === 'list' || /list/i.test(body.action || '')) return json({ ok: true, items: [], rows: [] });
      return json({ ok: true });
    }
    if (/\/agents\/conversations/.test(p)) return json(req.method() === 'GET' ? [] : { id: 'conv1', messages: [] });
    return json({ ok: true });
  });
}

const SCREENS = {
  OWNER: ['Dashboard', 'Products', 'Movements', 'Quotations', 'Reports', 'Settings', 'SupportTickets', 'Categories', 'Suppliers', 'Clients', 'PaymentMethods', 'Rubros', 'FundAccounts', 'PettyCash', 'Utility', 'SupplierPayments', 'MachinerySales', 'Courses', 'CourseCalendar', 'Enrollments', 'Contacts', 'Campaigns', 'HelpCenter', 'About', 'PermissionAdmin', 'Products/new', 'Movements/new', 'Quotations/new'],
  ALMACEN: ['Dashboard', 'Products', 'Movements', 'Quotations', 'Settings'],
  PLATFORM: ['Dashboard', 'LicenseAdmin', 'TenantRulesAdmin', 'SuperAdminLogs'],
};

// Runs in the page.
function inspect(atBottom) {
  const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=checkbox], [role=switch], [role=combobox]';
  const name = (el) => {
    const t = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || el.getAttribute('name') || '').replace(/\s+/g, ' ').trim().slice(0, 36);
    const cls = typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${t}"`;
  };
  const fixedAncestor = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === 'fixed') return n;
    }
    return null;
  };
  const stickyAncestor = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (getComputedStyle(n).position === 'sticky') return n;
    }
    return null;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    if (el.closest('[aria-hidden="true"], [inert], [data-sonner-toaster]')) return false;
    return true;
  };
  const list = [...document.querySelectorAll(SEL)].filter(visible).filter((el) => {
    // A checkbox/radio inside a label is measured via the label's own box.
    return !(el.tagName === 'INPUT' && el.closest('label') && ['checkbox', 'radio'].includes(el.type));
  });
  // Fixed wrappers (theme switcher, help chat) may not match SEL themselves.
  // The part of an element a person can actually see: its box clipped by every
  // scrolling / overflow-hidden ancestor (the sidebar's scrolled-away links,
  // table cells scrolled out of their card).
  const clippedRect = (el) => {
    let { left, top, right, bottom } = el.getBoundingClientRect();
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const b = n.getBoundingClientRect();
      if (cs.overflowX !== 'visible') { left = Math.max(left, b.left); right = Math.min(right, b.right); }
      if (cs.overflowY !== 'visible') { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  const items = list.map((el) => ({ el, r: el.getBoundingClientRect(), v: clippedRect(el), fixed: fixedAncestor(el), sticky: stickyAncestor(el) }));
  const overlaps = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // Two things that sit in the same fixed wrapper are one control.
      if (a.fixed && a.fixed === b.fixed) continue;
      // Page content scrolling under the sticky top bar is not a collision.
      if ((a.sticky && !b.sticky && !b.fixed) || (b.sticky && !a.sticky && !a.fixed)) continue;
      // Floating controls cover whatever scrolls beneath them: that is only a
      // defect once the page is scrolled to its end and a control is still hidden.
      if ((a.fixed || b.fixed) && !(a.fixed && b.fixed) && !atBottom) continue;
      if (!a.fixed && !b.fixed && atBottom) continue;
      // A label and its own input are the same control.
      if (a.el.closest('label') && a.el.closest('label') === b.el.closest('label')) continue;
      const w = Math.min(a.v.right, b.v.right) - Math.max(a.v.left, b.v.left);
      const h = Math.min(a.v.bottom, b.v.bottom) - Math.max(a.v.top, b.v.top);
      if (w > 3 && h > 3) overlaps.push(`${name(a.el)} [${Math.round(a.r.left)},${Math.round(a.r.top)} ${Math.round(a.r.width)}x${Math.round(a.r.height)}]  X  ${name(b.el)} [${Math.round(b.r.left)},${Math.round(b.r.top)} ${Math.round(b.r.width)}x${Math.round(b.r.height)}]`);
    }
  }
  const overflow = [];
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) overflow.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  for (const { el, r } of items) {
    // Fully off-canvas (the closed drawer) is hidden on purpose.
    if (r.right <= 0 || r.left >= vw) continue;
    // Inside a horizontally scrollable box (a data table) it is reachable by scrolling.
    let scroller = false;
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth) { scroller = true; break; }
    }
    if (scroller) continue;
    if (r.right > vw + 1 || r.left < -1) overflow.push(`${name(el)} outside viewport [${Math.round(r.left)}..${Math.round(r.right)}]`);
  }
  const clipped = [];
  for (const { el } of items) {
    if (!['BUTTON', 'A'].includes(el.tagName) && el.getAttribute('role') !== 'button') continue;
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') clipped.push(`${name(el)} ${el.scrollWidth}>${el.clientWidth}`);
  }
  return { overlaps, overflow, clipped };
}

async function main() {
  process.env.VITE_BASE44_APP_ID ||= 'mockapp';
  process.env.VITE_BASE44_APP_BASE_URL ||= 'http://localhost:1';
  // A production build served by `vite preview`: same CSS/breakpoints as the
  // dev server, but it answers in milliseconds, so the scan does not stall on
  // the dev server's on-demand transforms.
  const outDir = join(tmpdir(), 'stockflow-layout-scan-dist');
  await build({ logLevel: 'error', build: { outDir, emptyOutDir: true } });
  const server = await preview({ logLevel: 'error', build: { outDir }, preview: { port: 5311, strictPort: false } });
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  if (SHOTS) await mkdir(SHOTS, { recursive: true });
  let bad = 0;
  try {
    for (const width of WIDTHS) {
      const jobs = [['ANON', ['login']], ...Object.entries(SCREENS)];
      for (const [who, screens] of jobs) {
        const ctx = await browser.newContext({
          viewport: { width, height: HEIGHT[width] || 900 }, deviceScaleFactor: 1, isMobile: width < 1024, hasTouch: width < 1440,
          locale: 'es-MX', timezoneId: 'America/Mexico_City',
        });
        if (who !== 'ANON') await ctx.addInitScript(() => { localStorage.setItem('base44_access_token', 'mock'); localStorage.setItem('theme', 'light'); });
        await mockBackend(ctx, who === 'ANON' ? 'OWNER' : who);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
        for (const screen of screens) {
          if (ONLY && !ONLY.includes(screen)) continue;
          errors.length = 0;
          console.error(`.. ${width} ${who} ${screen}`);
          await page.goto(`${base}/${screen}`, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(1600);
          const probes = [['top', async () => {}], ['bottom', async () => { await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); document.querySelector('main')?.scrollTo(0, 1e6); }); await page.waitForTimeout(700); await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300); }]];
          const seen = new Set();
          for (const [label, act] of probes) {
            await act();
            const res = await page.evaluate(inspect, label === 'bottom');
            const lines = [...res.overlaps.map((s) => `OVERLAP ${s}`), ...res.overflow.map((s) => `OVERFLOW ${s}`), ...res.clipped.map((s) => `CLIPPED ${s}`)].filter((s) => !seen.has(s));
            lines.forEach((s) => seen.add(s));
            if (lines.length) {
              bad += lines.length;
              console.log(`FAIL ${width}px ${who} ${screen} (${label})\n  ${lines.join('\n  ')}`);
              if (SHOTS) await page.screenshot({ path: `${SHOTS}/${width}-${who}-${screen.replace('/', '_')}-${label}.png` });
            }
          }
          if (SHOTS && ALL_SHOTS && !seen.size) await page.screenshot({ path: `${SHOTS}/${width}-${who}-${screen.replace('/', '_')}-ok.png` });
          if (errors.length) console.log(`  [errors ${width} ${who} ${screen}: ${errors.join('; ')}]`);
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise((res) => server.httpServer.close(res));
  }
  console.log(bad ? `\n${bad} problems.` : '\nNo overlaps, overflow or clipped buttons.');
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
