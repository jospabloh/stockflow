/**
 * Columnas y filas de las exportaciones de lista (CSV / XLSX / PDF vía ExportMenu).
 *
 * Cada exportación lleva TODOS los campos de la entidad (menos `business_id`, que
 * es interno). Los campos sensibles (costos) solo se incluyen con su permiso y
 * entonces la COLUMNA no existe en el archivo. `base44/tests/import_export_fields_test.ts`
 * comprueba que cada campo del esquema tenga una columna aquí.
 */

const pad = (n) => String(n).padStart(2, "0");
/** Fecha UTC de Base44 (sin zona = UTC) → hora local. Sin dependencias (corre también en Deno). */
function localDate(value, withTime) {
  if (!value) return "";
  const str = String(value);
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(str) ? str : `${str}Z`);
  if (Number.isNaN(d.getTime())) return "";
  const day = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}
const isoDay = (value) => {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(String(value)) ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const YES_NO = (v) => (v ? "Sí" : "No");

// ─── Productos ───────────────────────────────────────────────────────────────
export function buildProductExport(products, categories = [], suppliers = [], { includeCost = false, includeSupplier = true } = {}) {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const sup = new Map(suppliers.map((s) => [s.id, s.name]));
  const columns = [
    { key: "name", label: "Nombre", type: "text" },
    { key: "sku", label: "SKU", type: "text" },
    { key: "barcode", label: "Código de barras", type: "text" },
    { key: "description", label: "Descripción", type: "text" },
    ...(includeCost ? [{ key: "purchase_price", label: "Precio Compra", type: "currency" }] : []),
    { key: "retail_sale_price", label: "Precio Menudeo", type: "currency" },
    { key: "wholesale_sale_price", label: "Precio Mayoreo", type: "currency" },
    { key: "stock", label: "Stock", type: "number" },
    { key: "min_stock", label: "Stock mínimo", type: "number" },
    { key: "unit", label: "Unidad", type: "text" },
    { key: "category", label: "Categoría", type: "text" },
    ...(includeSupplier ? [{ key: "supplier", label: "Proveedor", type: "text" }] : []),
    { key: "tax_rate", label: "IVA (%)", type: "number" },
    { key: "status", label: "Estatus", type: "text" },
    { key: "image_url", label: "Imagen (URL)", type: "text" },
  ];
  const rows = products.map((p) => ({
    name: p.name || "",
    sku: p.sku || "",
    barcode: p.barcode || "",
    description: p.description || "",
    ...(includeCost ? { purchase_price: p.purchase_price ?? 0 } : {}),
    retail_sale_price: p.retail_sale_price ?? 0,
    wholesale_sale_price: p.wholesale_sale_price ?? 0,
    stock: p.stock ?? 0,
    min_stock: p.min_stock ?? 5,
    unit: p.unit || "pieza",
    category: p.category ? (cat.get(p.category) || "") : "",
    ...(includeSupplier ? { supplier: p.supplier ? (sup.get(p.supplier) || "") : "" } : {}),
    tax_rate: p.tax_rate ?? 16,
    status: p.status === "inactive" ? "Inactivo" : "Activo",
    image_url: p.image_url || "",
  }));
  return { columns, rows };
}

// ─── Movimientos ─────────────────────────────────────────────────────────────
const STOCK_STATE = { pending: "Pendiente", applied: "Aplicado", failed: "Falló" };

/**
 * @param {object} opts
 * @param {(type:string)=>string} opts.typeLabel
 * @param {(m:object)=>number} opts.finalTotal  total ya neto de descuentos/devoluciones
 * @param {boolean} opts.includeCost  `cost_price` del movimiento (solo con Productos:cost_price)
 */
export function buildMovementExport(movements, { typeLabel, finalTotal, includeCost = false }) {
  const columns = [
    { key: "fecha", label: "Fecha", type: "text" },
    { key: "producto", label: "Producto", type: "text" },
    { key: "producto_id", label: "ID de producto", type: "text" },
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "cantidad", label: "Cantidad", type: "number" },
    { key: "precio_unit", label: "Precio Unit.", type: "currency" },
    ...(includeCost ? [{ key: "costo", label: "Costo", type: "currency" }] : []),
    { key: "total", label: "Total", type: "currency" },
    { key: "forma_pago", label: "Forma de Pago / Referencia", type: "text" },
    { key: "cliente", label: "Cliente / Motivo", type: "text" },
    { key: "pagado", label: "Pagado", type: "text" },
    { key: "cotizacion_id", label: "ID de cotización", type: "text" },
    { key: "stock_antes", label: "Stock antes", type: "number" },
    { key: "stock_despues", label: "Stock después", type: "number" },
    { key: "stock_aplicado", label: "Stock aplicado", type: "text" },
    { key: "estado_stock", label: "Estado del stock", type: "text" },
    { key: "error_stock", label: "Error de stock", type: "text" },
    { key: "stock_pendiente_desde", label: "Stock pendiente desde", type: "text" },
  ];
  const rows = movements.map((m) => ({
    fecha: localDate(m.data?.created_date || m.created_date, true),
    producto: m.product_name || "",
    producto_id: m.product_id || "",
    tipo: typeLabel(m.type),
    cantidad: m.quantity,
    precio_unit: m.unit_price || 0,
    ...(includeCost ? { costo: m.cost_price ?? 0 } : {}),
    total: finalTotal(m),
    forma_pago: m.reference || "",
    cliente: m.reason || "",
    pagado: YES_NO(m.paid),
    cotizacion_id: m.quotation_id || "",
    stock_antes: m.stock_before ?? "",
    stock_despues: m.stock_after ?? "",
    stock_aplicado: YES_NO(m.stock_applied),
    estado_stock: STOCK_STATE[m.stock_apply_state] || "",
    error_stock: m.stock_apply_error || "",
    stock_pendiente_desde: m.stock_pending_at || "",
  }));
  return { columns, rows };
}

// ─── Caja chica ──────────────────────────────────────────────────────────────
export function buildPettyCashExport(movements, typeLabel) {
  const columns = [
    { key: "fecha", label: "Fecha", type: "text" },
    { key: "tipo", label: "Tipo", type: "text" },
    { key: "descripcion", label: "Descripción", type: "text" },
    { key: "categoria", label: "Categoría", type: "text" },
    { key: "monto", label: "Monto", type: "currency" },
    { key: "referencia", label: "Referencia", type: "text" },
    { key: "notas", label: "Notas", type: "text" },
    { key: "metodo_pago", label: "Método de pago", type: "text" },
    { key: "generado_por_sistema", label: "Generado por el sistema", type: "text" },
    { key: "origen_tipo", label: "Tipo de origen", type: "text" },
    { key: "origen_id", label: "ID de origen", type: "text" },
  ];
  const rows = movements.map((m) => ({
    fecha: m.movement_date || isoDay(m.created_date),
    tipo: typeLabel(m.movement_type),
    descripcion: m.description || "",
    categoria: m.category || "",
    monto: m.amount,
    referencia: m.reference || "",
    notas: m.notes || "",
    metodo_pago: m.payment_method_snapshot || "",
    generado_por_sistema: YES_NO(m.generated_by_system),
    origen_tipo: m.origin_type || "",
    origen_id: m.origin_id || "",
  }));
  return { columns, rows };
}
