/**
 * Validación de duplicados de productos dentro de un mismo negocio (tenant).
 * Compara por nombre (case-insensitive + trim), SKU y código de barras.
 *
 * Uso:
 *   - checkProductDuplicate(base44, businessId, name, sku, barcode, excludeId?)
 *       → para crear/actualizar un solo producto.
 *   - buildDuplicateIndex(products) + checkAgainstIndex(index, name, sku, barcode)
 *       → para importación en lote (carga una vez, valida muchas filas).
 */

export interface DuplicateIndex {
  names: Set<string>;
  skus: Set<string>;
  barcodes: Set<string>;
}

export interface DuplicateResult {
  duplicate: boolean;
  field?: 'name' | 'sku' | 'barcode';
}

/** Construye índices de duplicados a partir de productos existentes. */
export function buildDuplicateIndex(products: any[]): DuplicateIndex {
  const names = new Set<string>();
  const skus = new Set<string>();
  const barcodes = new Set<string>();

  for (const p of products) {
    const name = (p.name || '').trim().toLowerCase();
    const sku = (p.sku || '').trim();
    const barcode = (p.barcode || '').trim();
    if (name) names.add(name);
    if (sku) skus.add(sku);
    if (barcode) barcodes.add(barcode);
  }

  return { names, skus, barcodes };
}

/** Verifica si un producto sería duplicado contra un índice existente. */
export function checkAgainstIndex(
  index: DuplicateIndex,
  name: string,
  sku: string,
  barcode: string
): DuplicateResult {
  const trimmedName = (name || '').trim().toLowerCase();
  const trimmedSku = (sku || '').trim();
  const trimmedBarcode = (barcode || '').trim();

  if (trimmedName && index.names.has(trimmedName)) {
    return { duplicate: true, field: 'name' };
  }
  if (trimmedSku && index.skus.has(trimmedSku)) {
    return { duplicate: true, field: 'sku' };
  }
  if (trimmedBarcode && index.barcodes.has(trimmedBarcode)) {
    return { duplicate: true, field: 'barcode' };
  }

  return { duplicate: false };
}

/** Agrega un producto al índice (para validación en lote durante importación). */
export function addToIndex(
  index: DuplicateIndex,
  name: string,
  sku: string,
  barcode: string
): void {
  const trimmedName = (name || '').trim().toLowerCase();
  const trimmedSku = (sku || '').trim();
  const trimmedBarcode = (barcode || '').trim();
  if (trimmedName) index.names.add(trimmedName);
  if (trimmedSku) index.skus.add(trimmedSku);
  if (trimmedBarcode) index.barcodes.add(trimmedBarcode);
}

const FIELD_LABELS: Record<string, string> = {
  name: 'nombre',
  sku: 'SKU',
  barcode: 'código de barras',
};

/**
 * Verifica duplicados para crear/actualizar un solo producto.
 * Carga los productos existentes del negocio y excluye el producto en edición
 * si se provee excludeProductId.
 */
export async function checkProductDuplicate(
  base44: any,
  businessId: string,
  name: string,
  sku: string,
  barcode: string,
  excludeProductId?: string
): Promise<DuplicateResult> {
  const existing = await base44.asServiceRole.entities.Product.filter({ business_id: businessId });
  const filtered = excludeProductId
    ? existing.filter((p: any) => p.id !== excludeProductId)
    : existing;
  const index = buildDuplicateIndex(filtered);
  return checkAgainstIndex(index, name, sku, barcode);
}

/** Mensaje de error user-friendly para un duplicado detectado. */
export function duplicateErrorMessage(result: DuplicateResult): string {
  if (!result.duplicate || !result.field) return 'Producto duplicado';
  return `Ya existe un producto con el mismo ${FIELD_LABELS[result.field]}`;
}