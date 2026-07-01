import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden eliminar movimientos' }, { status: 403 });
    }
    if (!user.business_id) {
      return Response.json({ error: 'Usuario sin negocio asignado' }, { status: 400 });
    }

    const { movement_id } = await req.json();
    if (!movement_id) {
      return Response.json({ error: 'movement_id requerido' }, { status: 400 });
    }

    // Obtener el movimiento como service role
    const movements = await base44.asServiceRole.entities.Movement.filter({ id: movement_id });
    const movement = movements[0];

    if (!movement) {
      return Response.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    }

    // Verificar que pertenece al mismo negocio
    if (movement.business_id !== user.business_id) {
      return Response.json({ error: 'No tienes permiso para eliminar este movimiento' }, { status: 403 });
    }

    // Obtener el producto actual
    const products = await base44.asServiceRole.entities.Product.filter({ id: movement.product_id });
    const product = products[0];

    if (!product) {
      // Producto ya no existe — solo eliminar el movimiento
      await base44.asServiceRole.entities.Movement.delete(movement_id);
      return Response.json({ success: true, note: 'Producto no encontrado, solo se eliminó el movimiento' });
    }

    if (product.business_id !== user.business_id) {
      return Response.json({ error: 'El producto no pertenece a tu negocio' }, { status: 403 });
    }

    // Calcular stock revertido según tipo de movimiento original
    let revertedStock = product.stock ?? 0;
    const qty = movement.quantity ?? 0;

    if (movement.type === 'entry') {
      // Entrada original sumó stock → revertir restando
      revertedStock = revertedStock - qty;
    } else if (movement.type === 'exit' || movement.type === 'return') {
      // Salida/devolución restó stock → revertir sumando
      revertedStock = revertedStock + qty;
    } else if (movement.type === 'adjustment') {
      // Ajuste establece stock absoluto — revertir al valor anterior al ajuste
      // stock_after del movimiento = el valor que quedó; para revertir necesitamos el valor ANTES
      // Buscamos el movimiento anterior al adjustment del mismo producto
      const previousMovements = await base44.asServiceRole.entities.Movement.filter(
        { product_id: movement.product_id, business_id: user.business_id },
        '-created_date',
        100
      );
      // Filtrar movimientos anteriores al que se está eliminando
      const sorted = previousMovements
        .filter(m => m.id !== movement_id)
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      const previousMovement = sorted.find(m => new Date(m.created_date) < new Date(movement.created_date));
      if (previousMovement && previousMovement.stock_after !== undefined) {
        revertedStock = previousMovement.stock_after;
      } else {
        // Sin historial previo: asumir stock 0 antes del ajuste
        revertedStock = 0;
      }
    }

    // Garantizar no negativos
    if (revertedStock < 0) revertedStock = 0;

    // Para entry/exit/return: eliminar primero — la automación syncProductStock
    // revierte el efecto del movimiento automáticamente en el evento 'delete'.
    // No se llama Product.update explícitamente para no duplicar la reversión.
    //
    // Para adjustment: la automación aplica -qty como delta, que puede no coincidir
    // con el stock previo al ajuste. Por eso sí se actualiza explícitamente aquí,
    // DESPUÉS de eliminar, para que el Product.update sea la escritura final.
    const isAdjustment = movement.type === 'adjustment';

    // Eliminar el movimiento (dispara automación para entry/exit/return)
    await base44.asServiceRole.entities.Movement.delete(movement_id);

    if (isAdjustment) {
      // Ajuste: sobreescribir el stock al valor correcto previo al ajuste,
      // compensando lo que la automación haya aplicado tras el delete.
      await base44.asServiceRole.entities.Product.update(product.id, { stock: revertedStock });
    }

    // TENANT-SCOPED: Reverse any system-generated petty cash income linked to this movement
    // Only relevant if this was a paid direct exit (not linked to a quotation)
    if (movement.type === 'exit' && !movement.quotation_id && movement.paid) {
      base44.asServiceRole.functions.invoke('syncCashSaleToPettyCash', {
        action: 'reverse',
        origin_type: 'movement',
        origin_id: movement_id,
        business_id: user.business_id,
      }).catch(() => {});
    }

    return Response.json({
      success: true,
      reverted_stock: revertedStock,
      movement_type: movement.type,
      quantity: qty,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}