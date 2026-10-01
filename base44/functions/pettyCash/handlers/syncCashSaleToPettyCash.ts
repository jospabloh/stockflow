import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RULE_KEY = 'cash_sales_to_petty_cash';
const DEFAULT_PAYMENT_METHODS = ['Efectivo'];
const DEFAULT_SOURCES = ['quotation', 'movement'];

type SyncAction = 'create' | 'reverse' | 'reconcile';

type CashRuleConfig = {
  payment_methods?: string[];
  sources?: string[];
  create_on?: 'cash_collection' | 'always';
  reverse_on_source_reversal?: boolean;
  reverse_on_payment_method_change?: boolean;
  prevent_duplicates?: boolean;
  generated_entry_lock_mode?: string;
};

function normalizeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function buildConfig(raw: unknown): Required<CashRuleConfig> {
  const config = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as CashRuleConfig : {};

  return {
    payment_methods: (Array.isArray(config.payment_methods) && config.payment_methods.length > 0)
      ? config.payment_methods.map((m) => String(m || '').trim()).filter(Boolean)
      : DEFAULT_PAYMENT_METHODS,
    sources: (Array.isArray(config.sources) && config.sources.length > 0)
      ? config.sources.map((s) => String(s || '').trim()).filter(Boolean)
      : DEFAULT_SOURCES,
    create_on: config.create_on === 'always' ? 'always' : 'cash_collection',
    reverse_on_source_reversal: config.reverse_on_source_reversal !== false,
    reverse_on_payment_method_change: config.reverse_on_payment_method_change !== false,
    prevent_duplicates: config.prevent_duplicates !== false,
    generated_entry_lock_mode: String(config.generated_entry_lock_mode || 'source_controlled'),
  };
}

function isAllowedSource(source: string, allowedSources: string[]) {
  if (!source) return false;
  const normalized = normalizeText(source);
  return allowedSources.some((s) => normalizeText(s) === normalized);
}

function isAllowedPaymentMethod(paymentMethod: string, allowedMethods: string[]) {
  if (!paymentMethod) return false;
  const normalized = normalizeText(paymentMethod);
  return allowedMethods.some((method) => normalizeText(method) === normalized);
}

// Deterministic winner for two generated entries that both claim the same
// (business_id, origin_id): oldest created_date wins, id breaks ties. Both
// the pre-write read and this post-write re-check use the same ordering, so
// concurrent callers converge on the same survivor instead of each keeping
// "their own" record.
function pickSurvivor(records: any[]) {
  return [...records].sort((a, b) => {
    const byDate = new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime();
    if (byDate !== 0) return byDate;
    return String(a.id).localeCompare(String(b.id));
  })[0];
}

// syncCashSaleToPettyCash has no atomic "insert-if-absent" available (Base44
// entity schemas don't support a DB-level uniqueness constraint — see
// CLAUDE.md), so the read-then-write below the caller of this helper is a
// TOCTOU window: two near-simultaneous calls for the same origin_id can both
// read "no existing record" and both create. This closes that window
// immediately after every write instead of before it: re-read what's
// actually in the table for (business_id, origin_id, generated_by_system),
// keep exactly one deterministic survivor, and neutralize the rest (amount
// zeroed + annotated, not deleted — same "keep the audit trail" convention
// used for the 2026-08-07 manual reconciliation of COT-260707-0001).
// This still allows a duplicate to exist for the few hundred ms between two
// concurrent writes, but it can never persist past the next call for that
// origin_id — including the call that created it, since the loser's own
// request performs this same cleanup before returning.
//
// Respects the same `prevent_duplicates` tenant-rule config the pre-write
// cleanup above already honors: when a tenant has explicitly turned it off,
// this only picks which record the response points at (the same
// deterministic survivor) — it never touches the other rows' data.
async function reconcileDuplicates(base44: any, business_id: string, origin_id: string, preventDuplicates: boolean) {
  const rows = await base44.asServiceRole.entities.PettyCashMovement.filter({ business_id, origin_id });
  const generated = rows.filter((r: any) => r.origin_id === origin_id && r.generated_by_system === true && !(r.notes || '').includes('[duplicado neutralizado'));
  if (generated.length <= 1) return generated[0] || null;

  const survivor = pickSurvivor(generated);
  if (!preventDuplicates) return survivor;

  for (const dup of generated) {
    if (dup.id === survivor.id) continue;
    await base44.asServiceRole.entities.PettyCashMovement.update(dup.id, {
      amount: 0,
      notes: `${dup.notes || ''} [duplicado neutralizado automáticamente por condición de carrera — ver ${survivor.id}]`.trim(),
    });
  }
  return survivor;
}

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // `action` es el nombre del handler en el router 'pettyCash'; la sub-acción
    // create|reverse|reconcile viaja en `sync_action`.
    const body = await req.json();
    const {
      sync_action,
      origin_type,
      origin_id,
      amount,
      payment_method,
      description,
      folio_or_ref,
      movement_date,
      business_id,
    } = body;

    // Auth de tenant. Los llamadores internos (createMovementSafe, convert,
    // cancel, register-payment, etc.) invocan con asServiceRole y pasan
    // CRON_SECRET; SÓLO ese secreto marca la llamada como service-role.
    // La ausencia de business_id en el usuario ya NO se trata como service-role
    // (era un bypass de aislamiento: un usuario recién registrado sin negocio
    // podía operar sobre CUALQUIER tenant pasando un business_id ajeno). Una
    // llamada directa de usuario sólo puede tocar su propio negocio.
    const cronSecretEnv = Deno.env.get('CRON_SECRET');
    const isServiceRole = Boolean(cronSecretEnv) && (
      req.headers.get('x-cron-secret') === cronSecretEnv ||
      body?.['x-cron-secret'] === cronSecretEnv
    );

    const user = isServiceRole ? null : await base44.auth.me().catch(() => null);
    if (!isServiceRole && !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!business_id) {
      return Response.json({ error: 'business_id is required' }, { status: 400 });
    }
    if (!isServiceRole && business_id !== user.business_id) {
      return Response.json({ error: 'Forbidden: business_id mismatch' }, { status: 403 });
    }

    const normalizedAction: SyncAction = ['create', 'reverse', 'reconcile'].includes(sync_action) ? sync_action : 'reconcile';

    if (!origin_type || !origin_id) {
      return Response.json({ error: 'origin_type and origin_id are required' }, { status: 400 });
    }

    // Defensa en profundidad (igual que applyMovementStock): el business_id del
    // body alimenta filtros asServiceRole (que ignoran RLS), así que lo anclamos
    // al registro de ORIGEN real. Si el origen existe y pertenece a otro tenant,
    // rechazamos — así un llamador sin business_id no puede crear/borrar caja
    // chica de otro negocio pasando un business_id ajeno. Si el origen no existe
    // (p. ej. 'reverse' tras un borrado), se continúa con el flujo normal.
    const ORIGIN_ENTITY: Record<string, string> = { movement: 'Movement', quotation: 'Quotation' };
    const originEntity = ORIGIN_ENTITY[normalizeText(origin_type)];
    if (originEntity) {
      try {
        const originRows = await base44.asServiceRole.entities[originEntity].filter({ id: origin_id });
        const origin = originRows[0];
        if (origin && origin.business_id && origin.business_id !== business_id) {
          return Response.json({ error: 'Forbidden: origin/business tenant mismatch' }, { status: 403 });
        }
      } catch (_) { /* si no se puede verificar el origen, continúan las validaciones normales */ }
    }

    const [ruleRows, allExisting] = await Promise.all([
      base44.asServiceRole.entities.TenantRule.filter({ business_id, rule_key: RULE_KEY }),
      base44.asServiceRole.entities.PettyCashMovement.filter({ business_id, origin_id }),
    ]);

    const rule = ruleRows.find((r) => !r.archived);
    const isRuleEnabled = Boolean(rule?.enabled);
    const ruleConfig = buildConfig(rule?.config_json);

    const existingGeneratedEntries = allExisting
      .filter((r) => r.origin_id === origin_id && r.generated_by_system === true)
      .sort((a, b) => new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime());

    const existingRecord = existingGeneratedEntries[0];

    if (!isRuleEnabled) {
      for (const stale of existingGeneratedEntries) {
        await base44.asServiceRole.entities.PettyCashMovement.delete(stale.id);
      }
      return Response.json({
        success: true,
        skipped: true,
        reason: 'rule_disabled',
        reversed: existingGeneratedEntries.length > 0,
      });
    }

    if (!isAllowedSource(origin_type, ruleConfig.sources)) {
      return Response.json({ success: true, skipped: true, reason: 'source_not_allowed' });
    }

    const qualifiesForCashIncome = Boolean(amount && amount > 0 && isAllowedPaymentMethod(payment_method || '', ruleConfig.payment_methods));
    const shouldReverseForAction = normalizedAction === 'reverse' && ruleConfig.reverse_on_source_reversal;
    const shouldReverseForPaymentChange = !qualifiesForCashIncome && ruleConfig.reverse_on_payment_method_change;
    const shouldReverse = shouldReverseForAction || shouldReverseForPaymentChange;

    if (shouldReverse) {
      for (const generated of existingGeneratedEntries) {
        await base44.asServiceRole.entities.PettyCashMovement.delete(generated.id);
      }
      if (rule?.id) {
        await base44.asServiceRole.entities.TenantRule.update(rule.id, { last_applied_at: new Date().toISOString() });
      }
      return Response.json({
        success: true,
        reversed: existingGeneratedEntries.length > 0,
        reason: existingGeneratedEntries.length > 0 ? 'reversed' : 'no_record_found',
      });
    }

    if (!qualifiesForCashIncome && ruleConfig.create_on === 'cash_collection') {
      return Response.json({ success: true, skipped: true, reason: 'payment_method_not_allowed' });
    }

    if (!movement_date) {
      return Response.json({ error: 'movement_date is required' }, { status: 400 });
    }

    const payload = {
      business_id,
      movement_type: 'income',
      amount,
      description: description || `Venta en efectivo — ${folio_or_ref || origin_id}`,
      category: 'Venta efectivo',
      movement_date,
      reference: folio_or_ref || origin_id,
      notes: `Generado automáticamente por regla tenant '${RULE_KEY}'. Origen: ${origin_type} ${origin_id}. lock_mode=${ruleConfig.generated_entry_lock_mode}.`,
      generated_by_system: true,
      origin_type,
      origin_id,
      payment_method_snapshot: payment_method,
    };

    if (ruleConfig.prevent_duplicates && existingGeneratedEntries.length > 1) {
      for (const duplicate of existingGeneratedEntries.slice(1)) {
        await base44.asServiceRole.entities.PettyCashMovement.delete(duplicate.id);
      }
    }

    if (existingRecord) {
      await base44.asServiceRole.entities.PettyCashMovement.update(existingRecord.id, payload);
      const survivorAfterUpdate = await reconcileDuplicates(base44, business_id, origin_id, ruleConfig.prevent_duplicates);
      if (rule?.id) {
        await base44.asServiceRole.entities.TenantRule.update(rule.id, { last_applied_at: new Date().toISOString() });
      }
      return Response.json({ success: true, updated: true, petty_cash_id: survivorAfterUpdate?.id || existingRecord.id });
    }

    const created = await base44.asServiceRole.entities.PettyCashMovement.create(payload);
    // Race-condition close: re-check right after the write. If a concurrent
    // call also created an entry for this same origin_id in the meantime,
    // exactly one deterministic survivor remains after this call returns.
    const survivorAfterCreate = await reconcileDuplicates(base44, business_id, origin_id, ruleConfig.prevent_duplicates);
    if (rule?.id) {
      await base44.asServiceRole.entities.TenantRule.update(rule.id, { last_applied_at: new Date().toISOString() });
    }
    const wasSurvivor = !survivorAfterCreate || survivorAfterCreate.id === created.id;
    return Response.json({
      success: true,
      created: wasSurvivor,
      updated: !wasSurvivor,
      petty_cash_id: survivorAfterCreate?.id || created.id,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
