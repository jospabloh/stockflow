/**
 * Normalización y validación compartidas por create/update de MachinerySale.
 *
 * `cost` está aparte a propósito: es el único campo del formulario que la UI
 * esconde tras 'Venta de Maquinaria:financials', así que quien no tenga ese
 * permiso nunca lo envía — y su guardado NO debe interpretarse como "ponlo en
 * cero". Ver `applyCost` abajo.
 */

export type MachinerySaleInput = {
  sale_date?: unknown;
  client_name?: unknown;
  client_business_name?: unknown;
  machine_type?: unknown;
  invoice_number?: unknown;
  cost?: unknown;
  sale_price?: unknown;
  notes?: unknown;
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const money = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Campos que cualquiera con create/edit puede escribir (todo menos el costo). */
export function normalizeFields(body: MachinerySaleInput) {
  return {
    sale_date: str(body.sale_date),
    client_name: str(body.client_name),
    client_business_name: str(body.client_business_name),
    machine_type: str(body.machine_type),
    invoice_number: str(body.invoice_number),
    sale_price: money(body.sale_price) ?? 0,
    notes: str(body.notes),
  };
}

/**
 * Decide qué costo se guarda.
 *
 * Sin permiso 'financials' el costo enviado se ignora por completo y se
 * conserva el almacenado (`stored`, `0` al crear). Si se tomara el valor del
 * cuerpo, un almacenista editando el cliente de una venta borraría su costo
 * —y con él la utilidad y la comisión— sin verlo nunca en pantalla.
 */
export function applyCost(body: MachinerySaleInput, canSeeFinancials: boolean, stored: number): number {
  if (!canSeeFinancials) return stored;
  return money(body.cost) ?? 0;
}

/** Devuelve un mensaje de error, o `null` si los campos son válidos. */
export function validate(fields: ReturnType<typeof normalizeFields>, cost: number): string | null {
  if (!fields.machine_type) return 'El tipo de máquina es obligatorio';
  if (fields.sale_date && !/^\d{4}-\d{2}-\d{2}$/.test(fields.sale_date)) {
    return 'La fecha debe tener formato YYYY-MM-DD';
  }
  if (fields.sale_price < 0) return 'El precio de venta no puede ser negativo';
  if (cost < 0) return 'El costo no puede ser negativo';
  return null;
}
