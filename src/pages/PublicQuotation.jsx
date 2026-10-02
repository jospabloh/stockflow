import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, AlertTriangle, Package } from "lucide-react";
import { FullPageLoader } from "@/components/ui/spinner";

const STATUS_CONFIG = {
  draft:     { label: "Borrador",   tone: "neutral" },
  sent:      { label: "Enviada",    tone: "accent" },
  accepted:  { label: "Aceptada",   tone: "accent" },
  converted: { label: "Convertida", tone: "accent" },
  cancelled: { label: "Cancelada",  tone: "danger" },
};

const DEFAULT_ACCENT = "#4F46E5";

function formatMXN(amount) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount ?? 0);
}

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function isExpired(valid_until) {
  if (!valid_until) return false;
  return new Date(valid_until + "T23:59:59") < new Date();
}

// Normalize a hex color to 6 digits, or null if invalid.
function normalizeHex(hex) {
  const c = (hex || "").replace("#", "").trim();
  if (c.length === 3) return c.split("").map((x) => x + x).join("");
  if (c.length === 6) return c;
  return null;
}

// Pick a legible foreground (#0F172A or #FFFFFF) for any accent color, by WCAG
// relative luminance — so light brand colors don't get unreadable white text.
function readableTextOn(hex) {
  const full = normalizeHex(hex);
  if (!full) return "#FFFFFF";
  const ch = (i) => parseInt(full.slice(i, i + 2), 16) / 255;
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(ch(0)) + 0.7152 * lin(ch(2)) + 0.0722 * lin(ch(4));
  return L > 0.55 ? "#0F172A" : "#FFFFFF";
}

// rgba tint of the accent for subtle surfaces.
function tint(hex, alpha) {
  const full = normalizeHex(hex) || normalizeHex(DEFAULT_ACCENT);
  const v = (i) => parseInt(full.slice(i, i + 2), 16);
  return `rgba(${v(0)}, ${v(2)}, ${v(4)}, ${alpha})`;
}

// Accent darkened enough to read as TEXT on white/tinted surfaces. Dark accents
// (e.g. teal) are returned essentially unchanged; light ones (e.g. yellow) are
// darkened until they have adequate contrast — so the Total figure never washes out.
function accentInk(hex) {
  const full = normalizeHex(hex) || normalizeHex(DEFAULT_ACCENT);
  let r = parseInt(full.slice(0, 2), 16);
  let g = parseInt(full.slice(2, 4), 16);
  let b = parseInt(full.slice(4, 6), 16);
  const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lum = () => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  let guard = 0;
  while (lum() > 0.3 && guard++ < 24) {
    r = Math.round(r * 0.85); g = Math.round(g * 0.85); b = Math.round(b * 0.85);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

export default function PublicQuotation() {
  const { token } = useParams();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [responding, setResponding] = useState(false);
  const [responded, setResponded] = useState(false);

  useEffect(() => {
    if (!token) return;
    base44.functions.invoke('quotations', { action: 'getPublicQuotation', token })
      .then(res => {
        if (res.data?.error) setError(res.data.error);
        else setQuotation(res.data);
      })
      .catch(() => setError("No se pudo cargar la cotización."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleRespond(response) {
    setResponding(true);
    try {
      const res = await base44.functions.invoke('quotations', { action: 'respondToPublicQuotation', token, response });
      if (res.data?.success) {
        setQuotation(prev => ({ ...prev, status: res.data.status }));
        setResponded(true);
      } else {
        setError(res.data?.error ?? "No se pudo procesar la respuesta.");
      }
    } catch {
      setError("Error al procesar la respuesta.");
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return <FullPageLoader label="Cargando cotización…" />;
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <AlertTriangle className="h-7 w-7 text-slate-400" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-slate-900">No encontramos esta cotización</p>
          <p className="mt-1 text-sm text-slate-500">{error ?? "El enlace puede haber expirado o ser incorrecto."}</p>
        </div>
        <a href="https://stockflow.app" className="mt-2 text-sm font-medium text-brand-600 hover:underline">
          Crea cotizaciones profesionales con StockFlow →
        </a>
      </div>
    );
  }

  const biz = quotation.business ?? {};
  const accent = normalizeHex(biz.primary_color) ? `#${normalizeHex(biz.primary_color)}` : DEFAULT_ACCENT;
  const onAccent = readableTextOn(accent);
  const accentText = accentInk(accent);
  const expired = isExpired(quotation.valid_until);
  const statusCfg = STATUS_CONFIG[quotation.status] ?? { label: quotation.status, tone: "neutral" };
  const issueDate = formatDate(quotation.created_date);
  const validDate = formatDate(quotation.valid_until);
  const items = quotation.items ?? [];

  const chipStyle =
    statusCfg.tone === "accent"
      ? { backgroundColor: tint(accent, 0.12), color: accentText }
      : statusCfg.tone === "danger"
      ? { backgroundColor: "rgba(220,38,38,0.1)", color: "#dc2626" }
      : { backgroundColor: "#f1f5f9", color: "#475569" };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Masthead — the business's brand leads */}
      <header style={{ backgroundColor: accent, color: onAccent }}>
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-4 px-5 py-6">
          <div className="flex items-center gap-3 min-w-0">
            {biz.logo_url && (
              <img
                src={biz.logo_url}
                alt={biz.name || "Logo"}
                className="h-12 w-12 shrink-0 rounded-xl object-cover bg-white/90 ring-1 ring-black/5"
              />
            )}
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold leading-tight truncate">{biz.name || "Cotización"}</h1>
              {biz.phone && <p className="text-sm opacity-80 truncate">{biz.phone}</p>}
              {biz.address && <p className="text-xs opacity-70 truncate">{biz.address}</p>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">Cotización</p>
            <p className="font-mono tabular text-lg font-semibold leading-tight">
              {quotation.folio ? `#${quotation.folio}` : "—"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Meta strip */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Para</p>
              <p className="font-medium text-slate-900">{quotation.client_name || "—"}</p>
            </div>
            <div className="flex items-center gap-6">
              {(issueDate || validDate) && (
                <div className="text-right">
                  {issueDate && (
                    <p className="text-xs text-slate-500">Emitida <span className="text-slate-700">{issueDate}</span></p>
                  )}
                  {validDate && (
                    <p className="text-xs text-slate-500">Válida hasta <span className="text-slate-700">{validDate}</span></p>
                  )}
                </div>
              )}
              <span
                className="inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold"
                style={chipStyle}
              >
                {statusCfg.label}
              </span>
            </div>
          </div>

          {/* Expiry warning */}
          {expired && quotation.status === "sent" && (
            <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <Clock className="h-4 w-4 shrink-0" />
              Esta cotización venció el {validDate ?? "su fecha de validez"}.
            </div>
          )}

          {/* Items */}
          <div className="px-5 py-5">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Package className="h-3.5 w-3.5" /> Productos
            </p>
            <div className="divide-y divide-slate-100">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{item.product_name}</p>
                    {item.product_description && (
                      <p className="truncate text-xs text-slate-500">{item.product_description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="font-mono tabular">{item.quantity}</span>
                      {" × "}
                      <span className="font-mono tabular">{formatMXN(item.unit_price)}</span>
                      {item.tax_rate ? ` (+${item.tax_rate}% IVA)` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono tabular font-semibold text-slate-900">{formatMXN(item.total)}</p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-5 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-mono tabular text-slate-700">{formatMXN(quotation.subtotal)}</span>
              </div>
              {quotation.tax > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>IVA</span>
                  <span className="font-mono tabular text-slate-700">{formatMXN(quotation.tax)}</span>
                </div>
              )}
              <div
                className="mt-2 flex items-center justify-between rounded-xl px-4 py-3"
                style={{ backgroundColor: tint(accent, 0.08) }}
              >
                <span className="font-display text-sm font-semibold text-slate-900">Total</span>
                <span className="font-mono tabular text-2xl font-bold" style={{ color: accentText }}>
                  {formatMXN(quotation.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="border-t border-slate-100 px-5 py-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notas</p>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{quotation.notes}</p>
            </div>
          )}

          {/* Business footer text */}
          {biz.quotation_footer && (
            <div className="border-t border-slate-100 px-5 py-4">
              <p className="whitespace-pre-wrap text-xs text-slate-400">{biz.quotation_footer}</p>
            </div>
          )}

          {/* Action zone — only when actionable */}
          {quotation.status === "sent" && !expired && !responded && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-5 sm:flex-row">
              <Button
                className="h-11 flex-1 gap-2 border-0 text-base font-semibold hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ backgroundColor: accent, color: onAccent }}
                disabled={responding}
                onClick={() => handleRespond("accepted")}
              >
                <CheckCircle className="h-5 w-5" />
                Aprobar cotización
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1 gap-2 border-slate-300 text-slate-600 hover:bg-slate-50"
                disabled={responding}
                onClick={() => handleRespond("rejected")}
              >
                <XCircle className="h-5 w-5" />
                Rechazar
              </Button>
            </div>
          )}

          {/* Confirmation after responding — clean, warm, branded */}
          {responded && (
            <div className="border-t border-slate-100 px-5 py-8 text-center">
              {quotation.status === "accepted" ? (
                <>
                  <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: tint(accent, 0.12), color: accentText }}
                  >
                    <CheckCircle className="h-7 w-7" />
                  </div>
                  <p className="mt-3 font-display text-lg font-semibold text-slate-900">¡Cotización aprobada!</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {biz.name || "El proveedor"} recibió tu aprobación y se pondrá en contacto contigo pronto.
                  </p>
                </>
              ) : (
                <>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <XCircle className="h-7 w-7" />
                  </div>
                  <p className="mt-3 font-display text-lg font-semibold text-slate-900">Cotización rechazada</p>
                  <p className="mt-1 text-sm text-slate-500">Gracias por tu respuesta.</p>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Quiet "powered by" footer */}
      <footer className="sticky bottom-0 border-t border-slate-200 bg-white/90 px-4 py-3 text-center text-sm text-slate-500 backdrop-blur">
        Generada con{" "}
        <a
          href="https://stockflow.app"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-600 hover:underline"
        >
          StockFlow
        </a>{" "}
        — <a
          href="https://stockflow.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 hover:underline"
        >
          pruébalo gratis
        </a>
      </footer>
    </div>
  );
}
