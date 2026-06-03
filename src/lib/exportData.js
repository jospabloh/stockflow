/**
 * Utilidad compartida de exportación de datos tabulares a CSV, XLSX y PDF.
 *
 * Forma de datos normalizada usada por todos los módulos:
 *   columns: Array<{ key, label, type?: 'text'|'number'|'currency'|'date', align? }>
 *   rows:    Array<Record<string, any>>   // cada fila indexada por column.key
 *
 * `type` controla el formato:
 *   - currency → "$1,234.56" (locale es-MX) en CSV/PDF, número nativo en XLSX
 *   - number   → número con separador de miles en CSV/PDF, número nativo en XLSX
 *   - date     → string tal cual (ya viene formateado por el módulo)
 *   - text     → string tal cual
 *
 * `xlsx`, `jspdf` y `jspdf-autotable` se cargan con import dinámico para no
 * inflar el bundle inicial: solo el formato elegido descarga su dependencia.
 */
import { toast } from "sonner";

const numberFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Resuelve la alineación efectiva de una columna. */
function resolveAlign(column) {
  if (column.align) return column.align;
  return column.type === "number" || column.type === "currency" ? "right" : "left";
}

/** Formatea un valor a texto legible (CSV / PDF). */
function formatCellForText(value, type) {
  if (value === null || value === undefined || value === "") return "";
  if (type === "currency") {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? currencyFormatter.format(num) : String(value);
  }
  if (type === "number") {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? numberFormatter.format(num) : String(value);
  }
  return String(value);
}

/**
 * Devuelve el valor apto para una celda de hoja de cálculo: número nativo para
 * number/currency (sumable en Excel), string para el resto.
 */
function formatCellForSheet(value, type) {
  if (value === null || value === undefined || value === "") return "";
  if (type === "currency" || type === "number") {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : String(value);
  }
  return String(value);
}

/** Escapa un valor para CSV (comillas, comas, saltos de línea). */
function escapeCSV(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Marca de tiempo (YYYY-MM-DD) para nombres de archivo y títulos. */
function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Dispara la descarga de un Blob como archivo. */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Valida que haya datos; si no, avisa y devuelve false. */
function ensureHasData(rows) {
  if (!rows || rows.length === 0) {
    toast.error("No hay datos para exportar");
    return false;
  }
  return true;
}

/** Exporta a CSV (sin dependencias externas). Siempre con BOM UTF-8. */
export function exportToCSV(columns, rows, filename) {
  if (!ensureHasData(rows)) return;
  const header = columns.map((c) => escapeCSV(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns.map((c) => escapeCSV(formatCellForText(row[c.key], c.type))).join(",")
    )
    .join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

/** Exporta a XLSX (SheetJS, import dinámico). Números/moneda quedan numéricos. */
export async function exportToXLSX(columns, rows, filename, { sheetName } = {}) {
  if (!ensureHasData(rows)) return;
  const XLSX = await import("xlsx");
  const aoa = [
    columns.map((c) => c.label),
    ...rows.map((row) => columns.map((c) => formatCellForSheet(row[c.key], c.type))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Ancho de columnas según el contenido más largo.
  ws["!cols"] = columns.map((c, idx) => {
    const maxLen = aoa.reduce((max, r) => {
      const len = String(r[idx] ?? "").length;
      return len > max ? len : max;
    }, c.label.length);
    return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
  });

  const wb = XLSX.utils.book_new();
  // Excel limita los nombres de hoja a 31 caracteres.
  const name = (sheetName || "Datos").slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, name);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Exporta a PDF tabular (jsPDF + autoTable, import dinámico). */
export async function exportToPDF(columns, rows, filename, { title, orientation } = {}) {
  if (!ensureHasData(rows)) return;
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const finalOrientation = orientation || (columns.length > 5 ? "landscape" : "portrait");
  const doc = new jsPDF({ orientation: finalOrientation, unit: "mm", format: "a4" });

  const heading = title || filename;
  doc.setFontSize(14);
  doc.text(heading, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generado: ${timestamp()}`, 14, 22);
  doc.setTextColor(0);

  const columnStyles = {};
  columns.forEach((c, idx) => {
    columnStyles[idx] = { halign: resolveAlign(c) };
  });

  autoTable(doc, {
    startY: 27,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => formatCellForText(row[c.key], c.type))),
    styles: { fontSize: 8, overflow: "linebreak", cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
    columnStyles,
    tableWidth: "auto",
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

/**
 * Punto de entrada único usado por ExportMenu.
 * @param {'csv'|'xlsx'|'pdf'} format
 */
export async function exportData(format, { columns, rows, filename, title, orientation, sheetName } = {}) {
  switch (format) {
    case "csv":
      return exportToCSV(columns, rows, filename);
    case "xlsx":
      return exportToXLSX(columns, rows, filename, { sheetName: sheetName || title });
    case "pdf":
      return exportToPDF(columns, rows, filename, { title, orientation });
    default:
      throw new Error(`Formato de exportación no soportado: ${format}`);
  }
}
