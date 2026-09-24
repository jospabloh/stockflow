/**
 * syncProductStock — automatización de Base44 sobre eventos de Movement.
 *
 * Es un NO-OP para todos los eventos, a propósito. Se conserva sólo para que el
 * workflow "Sync Product Stock on Movement" (que vive en el backend, no en el
 * repo) siga respondiendo 200 en vez de fallar; se puede archivar desde el panel.
 *
 * Por qué ya no escribe nada: leía `event`/`data`/`old_data` del CUERPO de la
 * petición, sin `auth.me()` ni CRON_SECRET, y escribía `Product.stock` como
 * service role. Cualquiera, sin sesión, podía mandar un "delete" inventado y
 * reescribir el stock de cualquier producto de cualquier negocio.
 *
 * Quién aplica el stock ahora:
 *   create → el escritor síncrono (applyMovementStock, o stock_applied=true);
 *            éste ya era un no-op desde antes.
 *   delete → deleteMovementSafe escribe el stock revertido él mismo, para todos
 *            los tipos.
 *   update → nada en el código cambia `Movement.quantity` (sólo flags de pago y
 *            stock_applied), así que el ajuste relativo no tenía llamador real.
 *   Lo que quede sin aplicar lo detecta dailyStockReconcile (stock_applied=false).
 */
Deno.serve(() => Response.json({ success: true, noop: true }));
