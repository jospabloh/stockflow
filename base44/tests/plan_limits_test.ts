// The app showed Start = 4 users while the pricing page customers subscribe
// from says 2 (2026-09-24). These pin the app to the published offer and keep
// the server and client copies from drifting apart again.
import * as server from '../functions/licenses/handlers/_planLimits.ts';
import * as client from '../../src/lib/planLimits.js';

function eq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: got ${a}, want ${b}`);
}

// Source: acaciaco-site apps/stockflow.html #planes — change both together.
const PUBLISHED = { start: 2, growth: 5 };

Deno.test('plan limits match the published pricing page', () => {
  eq(server.PLAN_LIMITS.start, PUBLISHED.start, 'start');
  eq(server.PLAN_LIMITS.growth, PUBLISHED.growth, 'growth');
  eq(server.PLAN_LIMITS.pro, server.UNLIMITED_USERS, 'pro is unlimited');
});

Deno.test('server and client copies are identical', () => {
  eq(JSON.stringify(server.PLAN_LIMITS), JSON.stringify(client.PLAN_USER_LIMITS), 'maps');
  eq(server.UNLIMITED_USERS, client.UNLIMITED_USERS, 'sentinel');
});

Deno.test('unknown or missing plan falls back to Start, never unlimited', () => {
  eq(server.userLimitFor(undefined), PUBLISHED.start, 'undefined');
  eq(server.userLimitFor('bogus'), PUBLISHED.start, 'bogus');
  eq(client.userLimitFor(null), PUBLISHED.start, 'client null');
});

Deno.test('unlimited displays as a word, not 999', () => {
  eq(client.formatUserLimit(client.UNLIMITED_USERS), 'Ilimitados', 'pro');
  eq(client.formatUserLimit(2), '2', 'start');
});
