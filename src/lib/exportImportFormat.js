/**
 * Exporta datos al formato CSV exacto que espera el importador (ImportProducts.jsx),
 * para que un archivo descargado pueda reimportarse directamente sin edición.
 *
 * Columnas y mapeo entidad → fila viven en `importSpec.js` (incluye TODOS los campos).
 */
import { IMPORT_HEADERS, productsToImportRows, categoriesToImportRows, clientsToImportRows } from "./importSpec.js";
import { toCSV } from "./csv.js";

export { productsToImportRows, categoriesToImportRows, clientsToImportRows };

/**
 * Texto CSV del archivo de importación (sin descargar). `omit` quita columnas (p. ej. costo).
 * @param {string} type
 * @param {Array<Record<string, any>>} rows
 * @param {{omit?: string[]}} [opts]
 */
export function buildImportCSV(type, rows, opts = {}) {
  const omit = opts.omit || [];
  const base = IMPORT_HEADERS[type];
  if (!base) throw new Error(`Tipo de exportación no soportado: ${type}`);
  const headers = base.filter((h) => !omit.includes(h));
  return toCSV(headers, rows.map((row) => headers.map((h) => row[h] ?? "")));
}

/**
 * @param {'products'|'categories'|'clients'} type
 * @param {Array<Record<string,any>>} rows — filas ya mapeadas a las columnas del import
 * @param {string} filename — nombre base sin extensión
 * @param {{omit?: string[]}} [opts] — columnas a omitir (datos sensibles sin permiso)
 */
export function exportImportFormat(type, rows, filename, opts = {}) {
  if (!rows || rows.length === 0) return;
  const csv = buildImportCSV(type, rows, opts);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
