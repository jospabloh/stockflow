// Planeación pura de la conversión de cotización (sin imports, sin SDK).
// Permite reanudar una conversión que se cortó a medias (incidente Baristop
// COT-261013-0004, 2026-10-15): se empareja lo que ya salió contra lo que falta.

// Ventana de seguridad: debe superar cualquier vida posible de la función. Si
// hay actividad reciente en las salidas existentes, una corrida puede seguir en
// vuelo (doble clic / reintento del cliente), así que nunca se reanuda dentro
// de esta ventana.
export const CONVERSION_STALE_MS = 10 * 60 * 1000;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

/** Última actividad (ms epoch) entre created_date y updated_date de los movimientos. */
export function lastActivityMs(movements: Row[]): number {
  let max = 0;
  for (const m of movements || []) {
    for (const v of [m?.updated_date, m?.created_date]) {
      const t = Date.parse(v);
      if (!Number.isNaN(t) && t > max) max = t;
    }
  }
  return max;
}

/**
 * Empareja los renglones con inventario contra las salidas ya existentes
 * (mismo product_id y misma cantidad, multiconjunto: cada salida se usa una vez).
 */
export function planConversion(items: Row[], existingExits: Row[]): { matched: Array<{ item: Row; movement: Row }>; missing: Row[] } {
  const matched: Array<{ item: Row; movement: Row }> = [];
  const missing: Row[] = [];
  const used = new Set<number>();
  const exits = existingExits || [];

  for (const item of (items || [])) {
    if (item.is_on_demand) continue;
    if (!item.product_id || !String(item.product_id).trim() || !item.product_name) continue;

    const idx = exits.findIndex((m, i) =>
      !used.has(i) && m.product_id === item.product_id && Number(m.quantity) === Number(item.quantity)
    );
    if (idx >= 0) {
      used.add(idx);
      matched.push({ item, movement: exits[idx] });
    } else {
      missing.push(item);
    }
  }
  return { matched, missing };
}

// Presupuesto de tiempo por invocación (ms). Pasado éste no se empiezan renglones
// nuevos y se responde 202 `partial`; el cliente continúa con `continuation: true`.
export const CONVERT_BUDGET_MS_DEFAULT = 60_000;
