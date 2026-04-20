import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Audita y corrige discrepancias de stock causadas por movimientos manuales
 * que aplicaron el delta dos veces (antes de 2026-04-20).
 *
 * FÓRMULA DEL EXCESO (por producto, solo movimientos pre-2026-04-20 sin quotation_id):
 *   exceso = Σ qty_entradas + Σ qty_ajustes - Σ qty_salidas - Σ qty_devoluciones
 *   stock_correcto = max(0, stock_actual - exceso)
 *
 * PARÁMETROS:
 *   dry_run (bool, default true): solo reporta, no modifica nada.
 *   product_id (string, opcional): audita/corrige solo ese producto.
 *   business_id (string): solo owners del sistema pueden especificar otro tenant.
 */

const BUG_FIX_DATE = '2026-04-20'; // fecha en que se eliminó updateProductStockSafe

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Solo administradores pueden ejecutar esta corrección' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dry_run: boolean = body.dry_run !== false;
    const targetProductId: string | undefined = body.product_id;
    const requestedBusinessId: string | undefined = body.business_id;

    let targetBusinessId: string;
    if (requestedBusinessId && requestedBusinessId !== user.business_id) {
      if (user.role !== 'owner') {
        return Response.json({ error: 'Solo owners del sistema pueden auditar otros tenants' }, { status: 403 });
      }
      targetBusinessId = requestedBusinessId;
    } else {
      targetBusinessId = user.business_id;
    }

    if (!targetBusinessId) {
      return Response.json({ error: 'business_id requerido' }, { status: 400 });
    }

    const [allProducts, movements] = await Promise.all([
      base44.asServiceRole.entities.Product.filter({ business_id: targetBusinessId }, 'name', 2000),
      base44.asServiceRole.entities.Movement.filter({ business_id: targetBusinessId }, 'created_date', 5000),
    ]);

    const products = targetProductId
      ? allProducts.filter(p => p.id === targetProductId)
      : allProducts;

    type MovementBreakdown = {
      date: string;
      type: string;
      quantity: number;
      reference?: string;
    };

    type DiscrepancyEntry = {
      product_id: string;
      product_name: string;
      current_stock: number;
      excess: number;
      correct_stock: number;
      has_adjustments: boolean;
      already_corrected: boolean;
      corrected: boolean;
      skipped_reason?: string;
      breakdown: {
        entries_count: number;
        entries_qty: number;
        exits_count: number;
        exits_qty: number;
        adjustments_count: number;
        adjustments_qty: number;
        contributing_movements: MovementBreakdown[];
      };
      justification: string;
    };

    const discrepancies: DiscrepancyEntry[] = [];
    let corrected_count = 0;
    let skipped_count = 0;

    for (const product of products) {
      const manualMovements = movements.filter(
        m => m.product_id === product.id && !m.quotation_id
      );

      if (manualMovements.length === 0) continue;

      // Calcular exceso acumulado
      let excess = 0;
      let entries_qty = 0, entries_count = 0;
      let exits_qty = 0, exits_count = 0;
      let adjustments_qty = 0, adjustments_count = 0;

      // Solo movimientos ANTES del bug fix (movimientos post-fix ya son correctos)
      const buggyMovements = manualMovements.filter(
        m => (m.created_date || '').slice(0, 10) < BUG_FIX_DATE
      );

      for (const m of buggyMovements) {
        if (m.type === 'entry') {
          excess += m.quantity;
          entries_qty += m.quantity;
          entries_count++;
        } else if (m.type === 'exit' || m.type === 'return') {
          excess -= m.quantity;
          exits_qty += m.quantity;
          exits_count++;
        } else if (m.type === 'adjustment') {
          excess += m.quantity;
          adjustments_qty += m.quantity;
          adjustments_count++;
        }
      }

      if (excess === 0) continue;

      const current_stock = product.stock ?? 0;
      const correct_stock = Math.max(0, current_stock - excess);
      const has_adjustments = buggyMovements.some(m => m.type === 'adjustment');

      // Detección de "ya corregido": si existe un ajuste manual POST-bug-fix
      // cuyo stock_after coincide con el stock actual, el admin ya lo corrigió.
      const postFixAdjustments = manualMovements.filter(
        m => m.type === 'adjustment' && (m.created_date || '').slice(0, 10) >= BUG_FIX_DATE
      );
      const alreadyCorrected = postFixAdjustments.some(
        m => m.stock_after !== undefined && m.stock_after === current_stock
      );

      if (alreadyCorrected) continue;

      // Construcción de justificación legible
      const parts: string[] = [];
      if (entries_count > 0) {
        parts.push(`${entries_count} entrada${entries_count > 1 ? 's' : ''} manual${entries_count > 1 ? 'es' : ''} (+${entries_qty} uds) aplicadas doble por el bug`);
      }
      if (exits_count > 0) {
        parts.push(`${exits_count} salida${exits_count > 1 ? 's' : ''} manual${exits_count > 1 ? 'es' : ''} (-${exits_qty} uds) aplicadas doble por el bug`);
      }
      if (adjustments_count > 0) {
        parts.push(`${adjustments_count} ajuste${adjustments_count > 1 ? 's' : ''} manual${adjustments_count > 1 ? 'es' : ''} (+${adjustments_qty} uds) aplicados como delta en lugar de absoluto`);
      }

      const direction = excess > 0
        ? `stock inflado en +${excess} uds`
        : `stock deflado en ${excess} uds`;

      const justification = `${parts.join('; ')}. Resultado: ${direction}. Correcto: ${current_stock} - (${excess}) = ${correct_stock}.`;

      const contributing_movements: MovementBreakdown[] = buggyMovements
        .filter(m => m.type !== 'adjustment' || true)
        .map(m => ({
          date: (m.created_date || '').slice(0, 10),
          type: m.type,
          quantity: m.quantity,
          reference: m.reference || m.reason || undefined,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const entry: DiscrepancyEntry = {
        product_id: product.id,
        product_name: product.name,
        current_stock,
        excess,
        correct_stock,
        has_adjustments,
        already_corrected: false,
        corrected: false,
        breakdown: {
          entries_count,
          entries_qty,
          exits_count,
          exits_qty,
          adjustments_count,
          adjustments_qty,
          contributing_movements,
        },
        justification,
      };

      if (has_adjustments) {
        entry.skipped_reason = 'Tiene ajustes manuales previos al bug-fix — requiere revisión manual del stock';
        skipped_count++;
        discrepancies.push(entry);
        continue;
      }

      if (!dry_run) {
        try {
          await base44.asServiceRole.entities.Product.update(product.id, {
            stock: correct_stock,
          });
          entry.corrected = true;
          corrected_count++;
          console.log(`[FIX-DOUBLE-STOCK] ✅ ${product.name}: ${current_stock} → ${correct_stock}`);
        } catch (err) {
          entry.skipped_reason = `Error: ${(err as Error).message}`;
          skipped_count++;
        }
      }

      discrepancies.push(entry);
    }

    const totalExcessUnits = discrepancies.reduce((s, r) => s + Math.abs(r.excess), 0);

    return Response.json({
      dry_run,
      business_id: targetBusinessId,
      audited_at: new Date().toISOString(),
      summary: {
        products_audited: allProducts.length,
        products_with_discrepancy: discrepancies.length,
        corrected: corrected_count,
        skipped_needs_manual_review: skipped_count,
        total_excess_units: totalExcessUnits,
      },
      discrepancies: discrepancies.map(r => ({
        product_id: r.product_id,
        product: r.product_name,
        current_stock: r.current_stock,
        correct_stock: r.correct_stock,
        excess: r.excess,
        direction: r.excess > 0 ? 'inflado' : 'deflado',
        has_adjustments: r.has_adjustments,
        corrected: r.corrected,
        skipped_reason: r.skipped_reason,
        justification: r.justification,
        breakdown: r.breakdown,
      })),
    });
  } catch (error) {
    console.log(`[FIX-DOUBLE-STOCK] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
