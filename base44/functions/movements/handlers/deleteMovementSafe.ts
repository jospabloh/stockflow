import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
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

    // Movimiento con estado de aplicación 'pending'/'failed' y sin confirmar: puede que el
    // producto NUNCA se haya escrito (o que sí). Revertir su efecto a ciegas dejaría el stock
    // desviado por qty, así que no se borra ni se revierte nada: requiere revisión humana.
    // Los movimientos SIN estado (p. ej. los 4 de Baristop con stock_applied=false, cuyo stock
    // SÍ cambió) conservan el comportamiento de siempre.
    if (
      (movement.stock_apply_state === 'pending' || movement.stock_apply_state === 'failed') &&
      movement.stock_applied !== true
    ) {
      return Response.json({
        success: false,
        needs_review: true,
        error: 'needs_review: este movimiento tiene el stock sin confirmar (pendiente/fallido); no se elimina ni se revierte automáticamente. Revisa el inventario del producto antes de eliminarlo.',
      }, { status: 409 });
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

    // Eliminar el movimiento y escribir el stock revertido AQUÍ, para todos los
    // tipos. Antes entry/exit/return dependían de que la automatización
    // syncProductStock revirtiera el efecto en el evento 'delete'; esa función
    // leía el movimiento del cuerpo de la petición sin autenticar a nadie, así
    // que cualquiera podía reescribir el stock de cualquier producto. Ahora es un
    // no-op y ésta es la única escritura de la reversión.
    await base44.asServiceRole.entities.Movement.delete(movement_id);
    await base44.asServiceRole.entities.Product.update(product.id, { stock: revertedStock });

    // TENANT-SCOPED: Reverse any system-generated petty cash income linked to this movement
    // Only relevant if this was a paid direct exit (not linked to a quotation)
    if (movement.type === 'exit' && !movement.quotation_id && movement.paid) {
      base44.asServiceRole.functions.invoke('pettyCash', {
        'x-cron-secret': Deno.env.get('CRON_SECRET'),
        action: 'syncCashSaleToPettyCash',
        sync_action: 'reverse',
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