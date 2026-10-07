/**
 * Mapeo y validación puros de filas de importación (Productos, Clientes, Categorías).
 *
 * Sin imports ni SDK: lo usan `importItemsSafe` y las pruebas de Deno. La lista de
 * columnas es espejo de `src/lib/importSpec.js` (el cliente no puede importar de
 * base44/); `base44/tests/import_export_fields_test.ts` falla si se separan, y
 * también si una columna deja de cubrir un campo del esquema de la entidad.
 *
 * Los encabezados se comparan sin distinguir mayúsculas, acentos ni espacios/guiones
 * (`Código de barras` == `codigo_barras`).
 */

import { validateProductStock } from './productStockValidation.ts';

export const PRODUCT_HEADERS = [
  'nombre', 'sku', 'codigo_barras', 'descripcion', 'precio_compra', 'precio_menudeo',
  'precio_mayoreo', 'stock', 'stock_minimo', 'unidad', 'categoria', 'proveedor',
  'iva', 'estatus', 'imagen_url',
];
export const CLIENT_HEADERS = [
  'nombre', 'nombre_negocio', 'giro', 'rfc', 'telefono', 'email', 'direccion', 'notas',
  'estatus', 'force_wholesale_all_products', 'force_purchase_all_products', 'force_zero_price',
];
export const CATEGORY_HEADERS = ['nombre', 'descripcion', 'cantidad_minima_mayoreo', 'color'];

export const VALID_UNITS = ['pieza', 'kg', 'litro', 'metro', 'caja', 'paquete'];

/** Encabezados alternativos aceptados (plantillas viejas o en inglés) → clave canónica. */
const ALIASES: Record<string, string> = {
  name: 'nombre',
  barcode: 'codigo_barras',
  codigo_de_barras: 'codigo_barras',
  precio_venta: 'precio_menudeo',
  tax_rate: 'iva',
  status: 'estatus',
  supplier: 'proveedor',
  image_url: 'imagen_url',
  description: 'descripcion',
  business_name: 'nombre_negocio',
  phone: 'telefono',
  address: 'direccion',
  notes: 'notas',
  wholesale_min_qty: 'cantidad_minima_mayoreo',
};

export function normalizeKey(key: unknown): string {
  const k = String(key ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');
  return ALIASES[k] ?? k;
}

export function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row || {})) {
    const nk = normalizeKey(k);
    if (nk in out && out[nk] !== '') continue; // la primera columna con valor gana
    out[nk] = v === null || v === undefined ? '' : String(v).trim();
  }
  return out;
}

type Result<T> = { error: string } | { value: T };

function num(raw: string, label: string, def: number, opts: { min?: number } = {}): Result<number> {
  if (raw === '') return { value: def };
  const n = Number(raw.replace(/[$\s]/g, ''));
  if (!Number.isFinite(n)) return { error: `"${label}" debe ser un número (se recibió "${raw}")` };
  if (opts.min !== undefined && n < opts.min) return { error: `"${label}" no puede ser menor a ${opts.min}` };
  return { value: n };
}

/** true/false, 1/0, sí/no. Vacío = valor por defecto; cualquier otra cosa = null (inválido). */
export function parseBool(raw: string, def = false): boolean | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === '') return def;
  if (['true', '1', 'si', 'sí', 'yes', 'activo'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return null;
}

function status(raw: string): 'active' | 'inactive' | null {
  const s = raw.trim().toLowerCase();
  if (s === '') return 'active';
  if (['active', 'activo', 'activa'].includes(s)) return 'active';
  if (['inactive', 'inactivo', 'inactiva'].includes(s)) return 'inactive';
  return null;
}

export interface ProductMapped {
  product: Record<string, unknown>;
  categoryName: string;
  supplierName: string;
}

export function mapProductRow(row: Record<string, string>): Result<ProductMapped> {
  const name = row.nombre || '';
  if (!name) return { error: 'El campo "nombre" es obligatorio' };
  const retail = num(row.precio_menudeo || '', 'precio_menudeo', 0, { min: 0 });
  if ('error' in retail) return retail;
  const purchase = num(row.precio_compra || '', 'precio_compra', 0, { min: 0 });
  if ('error' in purchase) return purchase;
  const wholesale = num(row.precio_mayoreo || '', 'precio_mayoreo', 0, { min: 0 });
  if ('error' in wholesale) return wholesale;
  const stock = num(row.stock || '', 'stock', 0);
  if ('error' in stock) return stock;
  // Misma regla que createProductSafe: sin stock negativo (quedaría sin Movement que lo respalde).
  const stockError = validateProductStock(stock.value);
  if (stockError) return { error: stockError };
  const minStock = num(row.stock_minimo || '', 'stock_minimo', 5, { min: 0 });
  if ('error' in minStock) return minStock;
  const unit = (row.unidad || 'pieza').toLowerCase();
  if (!VALID_UNITS.includes(unit)) {
    return { error: `Unidad inválida "${unit}". Valores aceptados: ${VALID_UNITS.join(', ')}` };
  }
  let taxRate = 16;
  if (row.iva) {
    const t = Number(row.iva.replace(/[%\s]/g, ''));
    if (t !== 0 && t !== 16) return { error: `"iva" debe ser 0 o 16 (se recibió "${row.iva}")` };
    taxRate = t;
  }
  const st = status(row.estatus || '');
  if (st === null) return { error: `"estatus" inválido "${row.estatus}". Use: activo/inactivo` };
  return {
    value: {
      categoryName: row.categoria || '',
      supplierName: row.proveedor || '',
      product: {
        name,
        sku: row.sku || '',
        barcode: row.codigo_barras || '',
        description: row.descripcion || '',
        purchase_price: purchase.value,
        retail_sale_price: retail.value,
        wholesale_sale_price: wholesale.value,
        stock: stock.value,
        min_stock: minStock.value,
        unit,
        tax_rate: taxRate,
        status: st,
        image_url: row.imagen_url || '',
      },
    },
  };
}

export function mapClientRow(row: Record<string, string>): Result<Record<string, unknown>> {
  const name = row.nombre || '';
  if (!name) return { error: 'El campo "nombre" es obligatorio' };
  const flags: Record<string, boolean> = {};
  for (const f of ['force_wholesale_all_products', 'force_purchase_all_products', 'force_zero_price']) {
    const b = parseBool(row[f] || '', false);
    if (b === null) {
      return { error: `El campo "${f}" tiene un valor inválido. Use: true/false, 1/0, sí/no` };
    }
    flags[f] = b;
  }
  if (flags.force_wholesale_all_products && flags.force_purchase_all_products) {
    return { error: 'No se puede activar "precio mayoreo" y "precio compra" al mismo tiempo para el mismo cliente' };
  }
  if (flags.force_zero_price && (flags.force_wholesale_all_products || flags.force_purchase_all_products)) {
    return { error: 'No se puede combinar "force_zero_price" con precio mayoreo o precio compra' };
  }
  const st = status(row.estatus || '');
  if (st === null) return { error: `"estatus" inválido "${row.estatus}". Use: activo/inactivo` };
  return {
    value: {
      name,
      business_name: row.nombre_negocio || '',
      giro: row.giro || '',
      rfc: row.rfc || '',
      phone: row.telefono || '',
      email: row.email || '',
      address: row.direccion || '',
      notes: row.notas || '',
      status: st,
      ...flags,
    },
  };
}

export function mapCategoryRow(row: Record<string, string>): Result<Record<string, unknown>> {
  const name = row.nombre || '';
  if (!name) return { error: 'El campo "nombre" es obligatorio' };
  const color = row.color || '#6366f1';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: `"color" debe ser hexadecimal #RRGGBB (se recibió "${row.color}")` };
  }
  let minQty: number | null = null;
  if (row.cantidad_minima_mayoreo !== undefined && row.cantidad_minima_mayoreo !== '') {
    const n = num(row.cantidad_minima_mayoreo, 'cantidad_minima_mayoreo', 0, { min: 0 });
    if ('error' in n) return n;
    minQty = n.value;
  }
  return {
    value: {
      name,
      description: row.descripcion || '',
      color,
      ...(minQty !== null ? { wholesale_min_qty: minQty } : {}),
    },
  };
}
