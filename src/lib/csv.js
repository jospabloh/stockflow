/**
 * CSV mínimo (RFC 4180): comillas dobles, comas y saltos de línea dentro de campos.
 * Lo usan la exportación en formato de importación y el importador, para que un
 * archivo exportado (descripciones con comas, notas con saltos de línea) vuelva a
 * leerse idéntico.
 */

/** Escapa un valor para CSV. */
export function escapeCSV(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Serializa encabezados + filas (arreglo de arreglos) a texto CSV. */
export function toCSV(headers, rows) {
  return [headers, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");
}

/** Parsea texto CSV a matriz de strings. Ignora el BOM y filas totalmente vacías. */
export function parseCSVMatrix(text) {
  const src = String(text ?? "").replace(/^﻿/, "");
  const out = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      out.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); out.push(row); }
  return out.filter((r) => r.some((c) => String(c).trim() !== ""));
}

/** Parsea CSV con encabezado a objetos { encabezado: valor }. Encabezados tal cual. */
export function parseCSVObjects(text) {
  const m = parseCSVMatrix(text);
  if (m.length < 2) return [];
  const headers = m[0].map((h) => h.trim());
  return m.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}
