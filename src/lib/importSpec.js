/**
 * Columnas de importación/exportación por entidad, y mapeo entidad → fila.
 *
 * Una sola fuente para: plantilla descargable, "CSV importación" de Productos /
 * Categorías / Clientes y el importador (ImportProducts.jsx). El servidor
 * (base44/shared/importMapping.ts) acepta exactamente estas columnas;
 * base44/tests/import_export_fields_test.ts compara las dos listas y exige que
 * cubran todos los campos de base44/entities/*.jsonc (salvo `business_id`, que
 * siempre lo fija el servidor).
 */

export const PRODUCT_HEADERS = [
  "nombre", "sku", "codigo_barras", "descripcion", "precio_compra", "precio_menudeo",
  "precio_mayoreo", "stock", "stock_minimo", "unidad", "categoria", "proveedor",
  "iva", "estatus", "imagen_url",
];
export const CLIENT_HEADERS = [
  "nombre", "nombre_negocio", "giro", "rfc", "telefono", "email", "direccion", "notas",
  "estatus", "force_wholesale_all_products", "force_purchase_all_products", "force_zero_price",
];
export const CATEGORY_HEADERS = ["nombre", "descripcion", "cantidad_minima_mayoreo", "color"];

export const IMPORT_HEADERS = {
  products: PRODUCT_HEADERS,
  clients: CLIENT_HEADERS,
  categories: CATEGORY_HEADERS,
};

/**
 * Campo de la entidad → columna del CSV. `business_id` no aparece: lo asigna el
 * servidor. `category` y `supplier` viajan por NOMBRE (el id no significa nada
 * fuera de este negocio).
 */
export const PRODUCT_FIELD_COLUMNS = {
  name: "nombre", sku: "sku", barcode: "codigo_barras", description: "descripcion",
  purchase_price: "precio_compra", retail_sale_price: "precio_menudeo",
  wholesale_sale_price: "precio_mayoreo", stock: "stock", min_stock: "stock_minimo",
  unit: "unidad", category: "categoria", supplier: "proveedor", tax_rate: "iva",
  status: "estatus", image_url: "imagen_url",
};
export const CLIENT_FIELD_COLUMNS = {
  name: "nombre", business_name: "nombre_negocio", giro: "giro", rfc: "rfc",
  phone: "telefono", email: "email", address: "direccion", notes: "notas", status: "estatus",
  force_wholesale_all_products: "force_wholesale_all_products",
  force_purchase_all_products: "force_purchase_all_products",
  force_zero_price: "force_zero_price",
};
export const CATEGORY_FIELD_COLUMNS = {
  name: "nombre", description: "descripcion", wholesale_min_qty: "cantidad_minima_mayoreo",
  color: "color",
};

const STATUS_ES = { active: "activo", inactive: "inactivo" };

/**
 * Productos → filas de importación (objetos por columna).
 * `includeCost=false` (usuario sin `Productos:cost_price`) quita la columna
 * `precio_compra` por completo: el costo nunca sale en el archivo.
 */
export function productsToImportRows(products, categories = [], suppliers = []) {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const sup = new Map(suppliers.map((s) => [s.id, s.name]));
  return products.map((p) => ({
    nombre: p.name || "",
    sku: p.sku || "",
    codigo_barras: p.barcode || "",
    descripcion: p.description || "",
    precio_compra: p.purchase_price ?? 0,
    precio_menudeo: p.retail_sale_price ?? 0,
    precio_mayoreo: p.wholesale_sale_price ?? 0,
    stock: p.stock ?? 0,
    stock_minimo: p.min_stock ?? 5,
    unidad: p.unit || "pieza",
    categoria: p.category ? (cat.get(p.category) || "") : "",
    proveedor: p.supplier ? (sup.get(p.supplier) || "") : "",
    iva: p.tax_rate ?? 16,
    estatus: STATUS_ES[p.status || "active"] || "activo",
    imagen_url: p.image_url || "",
  }));
}

export function categoriesToImportRows(categories) {
  return categories.map((c) => ({
    nombre: c.name || "",
    descripcion: c.description || "",
    cantidad_minima_mayoreo: c.wholesale_min_qty ?? "",
    color: c.color || "",
  }));
}

export function clientsToImportRows(clients) {
  return clients.map((c) => ({
    nombre: c.name || "",
    nombre_negocio: c.business_name || "",
    giro: c.giro || "",
    rfc: c.rfc || "",
    telefono: c.phone || "",
    email: c.email || "",
    direccion: c.address || "",
    notas: c.notes || "",
    estatus: STATUS_ES[c.status || "active"] || "activo",
    force_wholesale_all_products: !!c.force_wholesale_all_products,
    force_purchase_all_products: !!c.force_purchase_all_products,
    force_zero_price: !!c.force_zero_price,
  }));
}

// ─── Lectura de archivos ─────────────────────────────────────────────────────

/** Alias aceptados (plantillas viejas o en inglés); espejo de ALIASES del servidor. */
const HEADER_ALIASES = {
  name: "nombre", barcode: "codigo_barras", codigo_de_barras: "codigo_barras", precio_venta: "precio_menudeo", tax_rate: "iva",
  status: "estatus", supplier: "proveedor", image_url: "imagen_url", description: "descripcion",
  business_name: "nombre_negocio", phone: "telefono", address: "direccion", notes: "notas",
  wholesale_min_qty: "cantidad_minima_mayoreo",
};

/** Encabezado sin mayúsculas, acentos ni espacios/guiones: `Código de barras` → `codigo_de_barras`→ alias. */
export function normalizeHeader(h) {
  const k = String(h ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim().toLowerCase().replace(/[\s-]+/g, "_");
  return HEADER_ALIASES[k] ?? k;
}

/** Normaliza las llaves de una fila leída del CSV. */
export function normalizeImportRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeHeader(k);
    if (nk in out && out[nk] !== "") continue;
    out[nk] = String(v ?? "").trim();
  }
  return out;
}

/** Texto de una plantilla de ejemplo con TODAS las columnas del tipo. */
export const SAMPLE_ROWS = {
  products: [
    ["Producto Ejemplo", "SKU001", "7501234567890", "Descripción, con coma", 50, 100, 80, 25, 5, "pieza", "Electrónica", "Proveedor Uno", 16, "activo", "https://ejemplo.com/foto.jpg"],
    ["Otro Producto", "SKU002", "", "", 0, 200, 0, 10, 2, "caja", "", "", 0, "inactivo", ""],
  ],
  clients: [
    ["Juan Pérez", "Ferretería Pérez", "Ferretería", "PEPJ800101ABC", "449-123-4567", "juan@email.com", "Av. Principal 100", "Cliente frecuente", "activo", false, false, false],
    ["Distribuidora XYZ", "", "Distribución", "", "449-987-6543", "contacto@xyz.com", "Calle 5 #200", "", "activo", true, false, false],
  ],
  categories: [
    ["Electrónica", "Productos electrónicos y accesorios", 10, "#6366f1"],
    ["Herramientas", "Herramientas manuales y eléctricas", "", "#f59e0b"],
  ],
};
