/**
 * Exporta datos al formato CSV exacto que espera el importador (ImportProducts.jsx),
 * para que un archivo descargado pueda reimportarse directamente sin edición.
 *
 * Los headers coinciden con IMPORT_TYPES en ImportProducts.jsx.
 */

const IMPORT_HEADERS = {
  products: ["nombre","sku","codigo_barras","descripcion","precio_compra","precio_menudeo","precio_mayoreo","stock","stock_minimo","unidad","categoria"],
  categories: ["nombre","descripcion","cantidad_minima_mayoreo"],
  clients: ["nombre","nombre_negocio","giro","telefono","email","direccion","force_wholesale_all_products","force_purchase_all_products"],
};

function escapeCSV(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {'products'|'categories'|'clients'} type
 * @param {Array<Record<string,any>>} rows — filas ya mapeadas a las keys del import
 * @param {string} filename — nombre base sin extensión
 */
export function exportImportFormat(type, rows, filename) {
  const headers = IMPORT_HEADERS[type];
  if (!headers) throw new Error(`Tipo de exportación no soportado: ${type}`);
  if (!rows || rows.length === 0) return;

  const headerLine = headers.join(",");
  const bodyLines = rows.map((row) =>
    headers.map((h) => escapeCSV(row[h] ?? "")).join(",")
  );
  const csv = [headerLine, ...bodyLines].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Mapea productos del SDK al formato de importación.
 * @param {Array} products — entidades Product
 * @param {Array} categories — entidades Category (para resolver el nombre)
 */
export function productsToImportRows(products, categories) {
  const catNameById = new Map(categories.map((c) => [c.id, c.name]));
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
    categoria: p.category ? (catNameById.get(p.category) || "") : "",
  }));
}

/**
 * Mapea categorías del SDK al formato de importación.
 */
export function categoriesToImportRows(categories) {
  return categories.map((c) => ({
    nombre: c.name || "",
    descripcion: c.description || "",
    cantidad_minima_mayoreo: c.wholesale_min_qty ?? "",
  }));
}