import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Audita y corrige el bug de doble actualización de stock (2026-04-20).
 *
 * CAUSA RAÍZ: MovementFormDialog llamaba a updateProductStockSafe() justo después
 * de createMovementSafe(). La automatización syncProductStock también aplica el
 * delta al stock al crear cada Movement. La llamada explícita a updateProductStockSafe
 * hacía que la automatización ejecutara el delta una segunda vez sobre el stock ya
 * actualizado, duplicando el efecto neto. Las salidas de cotizaciones (convertQuotationSafe)
 * no tenían esta llamada extra, por lo que no se vieron afectadas.
 *
 * FÓRMULA DEL EXCESO (por producto):
 *   exceso = Σ qty_entradas_manuales + Σ qty_ajustes_manuales
 *           - Σ qty_salidas_manuales - Σ qty_devoluciones_manuales
 *   stock_correcto = max(0, stock_actual - exceso)
 *
 * "Manual" = movements con quotation_id NULL.
 *
 * PARÁMETROS:
 *   dry_run (bool, default true): solo reporta, no modifica nada.
 *   business_id (string): solo owners del sistema pueden especificar otro tenant.
 */

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
    const dry_run: boolean = body.dry_run !== false; // default: true (seguro)
    const requestedBusinessId: string | undefined = body.business_id;

    // Cross-tenant override only for owners
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

    console.log(`[FIX-DOUBLE-STOCK] Iniciando auditoría para business ${targetBusinessId} (dry_run=${dry_run})`);

    const [products, movements] = await Promise.all([
      base44.asServiceRole.entities.Product.filter({ business_id: targetBusinessId }, 'name', 2000),
      base44.asServiceRole.entities.Movement.filter({ business_id: targetBusinessId }, 'created_date', 5000),
    ]);

    console.log(`[FIX-DOUBLE-STOCK] ${products.length} productos, ${movements.length} movimientos`);

    type DiscrepancyEntry = {
      product_id: string;
      product_name: string;
      current_stock: number;
      excess: number;
      correct_stock: number;
      manual_movements_count: number;
      has_adjustments: boolean;
      corrected: boolean;
      skipped_reason?: string;
    };

    const discrepancies: DiscrepancyEntry[] = [];
    let corrected_count = 0;
    let skipped_count = 0;

    for (const product of products) {
      const manualMovements = movements.filter(
        m => m.product_id === product.id && !m.quotation_id
      );

      if (manualMovements.length === 0) continue;

      // Calcular exceso acumulado de movimientos manuales:
      // Cada movimiento manual causó que syncProductStock aplicara el delta
      // UNA VEZ MÁS sobre el stock ya actualizado por updateProductStockSafe.
      let excess = 0;
      for (const m of manualMovements) {
        if (m.type === 'entry') {
          excess += m.quantity;          // automation sumó qty extra → stock inflado
        } else if (m.type === 'exit' || m.type === 'return') {
          excess -= m.quantity;          // automation restó qty extra → stock deflado
        } else if (m.type === 'adjustment') {
          excess += m.quantity;          // automation sumó qty extra (en lugar de set absoluto)
        }
      }

      if (excess === 0) continue;

      const current_stock = product.stock ?? 0;
      const correct_stock = Math.max(0, current_stock - excess);
      const has_adjustments = manualMovements.some(m => m.type === 'adjustment');

      const entry: DiscrepancyEntry = {
        product_id: product.id,
        product_name: product.name,
        current_stock,
        excess,
        correct_stock,
        manual_movements_count: manualMovements.length,
        has_adjustments,
        corrected: false,
      };

      // Ajustes requieren revisión manual: la interacción absolute-set + delta
      // de la automatización es compleja y podría overcorregir.
      if (has_adjustments) {
        entry.skipped_reason = 'Tiene ajustes manuales — requiere revisión manual del stock';
        skipped_count++;
        discrepancies.push(entry);
        continue;
      }

      if (!dry_run) {
        try {
          // Actualización directa: igual que deleteMovementSafe usa Product.update
          // para no disparar syncProductStock de nuevo con un movement de corrección.
          await base44.asServiceRole.entities.Product.update(product.id, {
            stock: correct_stock,
          });
          entry.corrected = true;
          corrected_count++;
          console.log(`[FIX-DOUBLE-STOCK] ✅ ${product.name}: ${current_stock} → ${correct_stock} (exceso era ${excess})`);
        } catch (err) {
          entry.skipped_reason = `Error: ${(err as Error).message}`;
          skipped_count++;
          console.log(`[FIX-DOUBLE-STOCK] ❌ ${product.name}: ${(err as Error).message}`);
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
        products_audited: products.length,
        products_with_discrepancy: discrepancies.length,
        corrected: corrected_count,
        skipped_needs_manual_review: skipped_count,
        total_excess_units: totalExcessUnits,
      },
      discrepancies: discrepancies.map(r => ({
        product: r.product_name,
        current_stock: r.current_stock,
        correct_stock: r.correct_stock,
        excess: r.excess,
        direction: r.excess > 0 ? '↑ inflado' : '↓ deflado',
        manual_movements: r.manual_movements_count,
        has_adjustments: r.has_adjustments,
        status: r.corrected ? '✅ corregido' : r.skipped_reason ? `⚠️ omitido: ${r.skipped_reason}` : '📋 solo reporte (dry_run)',
      })),
    });
  } catch (error) {
    console.log(`[FIX-DOUBLE-STOCK] ERROR: ${(error as Error).message}`);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
