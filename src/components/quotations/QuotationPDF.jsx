import { jsPDF } from "jspdf";

function fmt(n) {
  return (n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateQuotationPDF(quotation, settings) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 18;
  const contentW = W - margin * 2;

  // Colors
  const primary = [79, 70, 229]; // indigo-600
  const lightGray = [248, 250, 252];
  const darkText = [30, 41, 59];
  const mutedText = [100, 116, 139];
  const borderColor = [226, 232, 240];

  // ─── HEADER BAND ─────────────────────────────────────────────
  doc.setFillColor(...primary);
  doc.rect(0, 0, W, 38, "F");

  // Business name
  const businessName = settings?.business_name || "Mi Empresa";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(businessName, margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (settings?.address) doc.text(settings.address, margin, 22);
  if (settings?.phone) doc.text(`Tel: ${settings.phone}`, margin, 27);
  if (settings?.rfc) doc.text(`RFC: ${settings.rfc}`, margin, 32);

  // COTIZACIÓN label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("COTIZACIÓN", W - margin, 16, { align: "right" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(quotation.folio || "", W - margin, 23, { align: "right" });

  // ─── CLIENT & META BLOCK ─────────────────────────────────────
  let y = 48;

  // Two column cards
  const cardH = 32;
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, y, contentW * 0.6 - 4, cardH, 3, 3, "F");
  doc.roundedRect(margin + contentW * 0.6, y, contentW * 0.4, cardH, 3, 3, "F");

  // Client info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...mutedText);
  doc.text("CLIENTE", margin + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...darkText);
  doc.text(quotation.client_name || "", margin + 4, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  if (quotation.client_email) doc.text(quotation.client_email, margin + 4, y + 19);
  if (quotation.client_phone) doc.text(quotation.client_phone, margin + 4, y + 25);

  // Meta
  const mx = margin + contentW * 0.6 + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...mutedText);
  doc.text("FECHA", mx, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...darkText);
  const dateStr = new Date(quotation.created_date || Date.now()).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(dateStr, mx, y + 12);

  if (quotation.valid_until) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...mutedText);
    doc.text("VIGENCIA", mx, y + 19);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...darkText);
    const vd = new Date(quotation.valid_until + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    doc.text(vd, mx, y + 25);
  }

  if (quotation.payment_method) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...mutedText);
    doc.text("FORMA DE PAGO", mx, y + (quotation.valid_until ? 30 : 19));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...darkText);
    doc.text(quotation.payment_method, mx, y + (quotation.valid_until ? 36 : 25));
  }

  y += cardH + 12;

  // ─── ITEMS TABLE ─────────────────────────────────────────────
  // Header row
  doc.setFillColor(...primary);
  doc.rect(margin, y, contentW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  const cols = {
    num: margin + 2,
    name: margin + 10,
    qty: margin + contentW * 0.56,
    price: margin + contentW * 0.7,
    total: margin + contentW - 2,
  };

  doc.text("#", cols.num, y + 5.5);
  doc.text("DESCRIPCIÓN", cols.name, y + 5.5);
  doc.text("CANT.", cols.qty, y + 5.5);
  doc.text("PRECIO UNIT.", cols.price, y + 5.5);
  doc.text("TOTAL", cols.total, y + 5.5, { align: "right" });
  y += 8;

  // Rows
  const items = quotation.items || [];
  items.forEach((item, i) => {
    const rowH = 8;
    if (i % 2 === 0) {
      doc.setFillColor(...lightGray);
      doc.rect(margin, y, contentW, rowH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...darkText);
    doc.text(String(i + 1), cols.num, y + 5.5);

    // truncate name
    const maxNameW = contentW * 0.54;
    const name = item.product_name || "";
    const nameClipped = doc.getTextWidth(name) > maxNameW
      ? name.substring(0, Math.floor(name.length * maxNameW / doc.getTextWidth(name))) + "..."
      : name;
    doc.text(nameClipped, cols.name, y + 5.5);
    doc.text(String(item.quantity || 0), cols.qty, y + 5.5);
    doc.text(`$${fmt(item.unit_price)}`, cols.price, y + 5.5);
    doc.text(`$${fmt(item.total)}`, cols.total, y + 5.5, { align: "right" });
    y += rowH;
  });

  // Bottom border of table
  doc.setDrawColor(...borderColor);
  doc.line(margin, y, margin + contentW, y);
  y += 6;

  // ─── TOTALS ──────────────────────────────────────────────────
  const totalsX = margin + contentW * 0.55;
  const totalsW = contentW * 0.45;

  const drawTotalRow = (label, value, bold = false, highlight = false) => {
    if (highlight) {
      doc.setFillColor(...primary);
      doc.rect(totalsX - 2, y - 1, totalsW + 2, 9, "F");
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(...darkText);
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10 : 8.5);
    doc.text(label, totalsX, y + 5);
    doc.text(`$${fmt(value)}`, margin + contentW - 2, y + 5, { align: "right" });
    y += 9;
  };

  drawTotalRow("Subtotal", quotation.subtotal || 0);
  if (quotation.tax > 0) {
    const label = `${quotation.tax_label || "IVA"} (${quotation.tax_rate || 16}%)`;
    drawTotalRow(label, quotation.tax || 0);
  }
  drawTotalRow("TOTAL", quotation.total || 0, true, true);

  y += 8;

  // ─── NOTES ───────────────────────────────────────────────────
  if (quotation.notes) {
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, y, contentW, 4, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...mutedText);
    doc.text("NOTAS Y CONDICIONES", margin + 4, y + 3);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...darkText);
    const noteLines = doc.splitTextToSize(quotation.notes, contentW - 8);
    noteLines.forEach(line => {
      doc.text(line, margin + 4, y + 3);
      y += 5;
    });
    y += 4;
  }

  // ─── FOOTER ──────────────────────────────────────────────────
  const pageH = 297;
  doc.setFillColor(...primary);
  doc.rect(0, pageH - 14, W, 14, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Este documento es una cotización y no representa una factura fiscal.", W / 2, pageH - 8, { align: "center" });
  doc.text(`${businessName} · Gracias por su preferencia`, W / 2, pageH - 4, { align: "center" });

  doc.save(`Cotizacion-${quotation.folio || "sin-folio"}.pdf`);
}