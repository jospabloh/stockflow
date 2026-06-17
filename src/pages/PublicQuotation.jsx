import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Clock, AlertTriangle, Package } from "lucide-react";
import { FullPageLoader } from "@/components/ui/spinner";

const STATUS_CONFIG = {
  draft:     { label: "Borrador",   color: "secondary" },
  sent:      { label: "Enviada",    color: "default" },
  accepted:  { label: "Aceptada",   color: "default" },
  converted: { label: "Convertida", color: "default" },
  cancelled: { label: "Cancelada",  color: "destructive" },
};

function formatMXN(amount) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount ?? 0);
}

function isExpired(valid_until) {
  if (!valid_until) return false;
  return new Date(valid_until + "T23:59:59") < new Date();
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
    base44.functions.invoke("getPublicQuotation", { token })
      .then(res => {
        if (res.data?.error) setError(res.data.error);
        else setQuotation(res.data);
      })
      .catch(() => setError("No se pudo cargar la cotización."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleRespond(action) {
    setResponding(true);
    try {
      const res = await base44.functions.invoke("respondToPublicQuotation", { token, action });
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

  const biz = quotation?.business ?? {};
  const primaryColor = biz.primary_color ?? "#4F46E5";
  const expired = isExpired(quotation?.valid_until);
  const statusCfg = STATUS_CONFIG[quotation?.status] ?? { label: quotation?.status, color: "secondary" };

  if (loading) {
    return <FullPageLoader label="Cargando cotización…" />;
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 p-6">
        <AlertTriangle className="w-12 h-12 text-gray-400" />
        <p className="text-gray-600 text-center">{error ?? "Cotización no encontrada."}</p>
        <a
          href="https://stockflow.app"
          className="text-sm text-indigo-600 hover:underline"
        >
          ¿Quieres crear cotizaciones profesionales? Prueba StockFlow gratis
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Business header */}
      <div style={{ backgroundColor: primaryColor }} className="text-white p-5">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          {biz.logo_url && (
            <img
              src={biz.logo_url}
              alt={biz.name}
              className="w-14 h-14 rounded-full object-cover bg-white"
            />
          )}
          <div>
            <h1 className="text-xl font-bold">{biz.name}</h1>
            {biz.phone && <p className="text-sm opacity-80">{biz.phone}</p>}
            {biz.address && <p className="text-sm opacity-80">{biz.address}</p>}
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="max-w-2xl mx-auto w-full px-4 py-6 flex-1">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Title row */}
          <div className="p-5 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Cotización</p>
              <h2 className="text-lg font-semibold text-gray-900">
                {quotation.folio ? `#${quotation.folio}` : "Sin folio"}
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">Para: {quotation.client_name}</p>
            </div>
            <Badge variant={statusCfg.color} className="shrink-0">{statusCfg.label}</Badge>
          </div>

          {/* Expiry warning */}
          {expired && quotation.status === "sent" && (
            <div className="mx-5 mb-4 flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-sm">
              <Clock className="w-4 h-4 shrink-0" />
              Esta cotización venció el {new Date(quotation.valid_until).toLocaleDateString("es-MX")}.
            </div>
          )}

          <Separator />

          {/* Items table */}
          <div className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> Productos
            </p>
            <div className="space-y-2">
              {(quotation.items ?? []).map((item, i) => (
                <div key={i} className="flex justify-between gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{item.product_name}</p>
                    {item.product_description && (
                      <p className="text-xs text-gray-500 truncate">{item.product_description}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {item.quantity} × {formatMXN(item.unit_price)}
                      {item.tax_rate ? ` (+${item.tax_rate}% IVA)` : ""}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900 shrink-0">{formatMXN(item.total)}</p>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>{formatMXN(quotation.subtotal)}</span>
              </div>
              {quotation.tax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>IVA</span><span>{formatMXN(quotation.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
                <span>Total</span><span>{formatMXN(quotation.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <>
              <Separator />
              <div className="p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notas</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
              </div>
            </>
          )}

          {/* Footer text */}
          {biz.quotation_footer && (
            <>
              <Separator />
              <div className="p-5">
                <p className="text-xs text-gray-500 whitespace-pre-wrap">{biz.quotation_footer}</p>
              </div>
            </>
          )}

          {/* Action buttons — only when status is "sent" and not expired */}
          {quotation.status === "sent" && !expired && !responded && (
            <>
              <Separator />
              <div className="p-5 flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1 gap-2"
                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                  disabled={responding}
                  onClick={() => handleRespond("accepted")}
                >
                  <CheckCircle className="w-4 h-4" />
                  Aprobar cotización
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  disabled={responding}
                  onClick={() => handleRespond("rejected")}
                >
                  <XCircle className="w-4 h-4" />
                  Rechazar
                </Button>
              </div>
            </>
          )}

          {/* Confirmation message after responding */}
          {responded && (
            <>
              <Separator />
              <div className="p-5 text-center">
                {quotation.status === "accepted" ? (
                  <p className="text-green-700 font-medium flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" /> ¡Cotización aprobada! El proveedor se pondrá en contacto pronto.
                  </p>
                ) : (
                  <p className="text-gray-600 flex items-center justify-center gap-2">
                    <XCircle className="w-5 h-5" /> Cotización rechazada. Gracias por tu respuesta.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sticky viral CTA */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 py-3 px-4 text-center text-sm text-gray-500">
        Cotización generada con{" "}
        <a
          href="https://stockflow.app"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-indigo-600 hover:underline"
        >
          StockFlow
        </a>{" "}
        —{" "}
        <a
          href="https://stockflow.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline"
        >
          ¡Pruébalo gratis!
        </a>
      </div>
    </div>
  );
}
