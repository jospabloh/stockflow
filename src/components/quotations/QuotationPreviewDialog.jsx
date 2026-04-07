import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Truck, CheckCircle2, DollarSign } from "lucide-react";
import { generateQuotationPDF } from "./QuotationPDF";
import { calculateLineVAT, formatMXN } from "@/lib/vatCalculator";

function fmt(n) {
  return (n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuotationPreviewDialog({ quotation, settings, open, onOpenChange }) {
  const [downloading, setDownloading] = useState(false);
  if (!open || !quotation) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await generateQuotationPDF(quotation, settings);
    } finally {
      setDownloading(false);
    }
  };

  const dateStr = new Date(quotation.created_date || Date.now()).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const validStr = quotation.valid_until
    ? new Date(quotation.valid_until + "T12:00:00").toLocaleDateString("es-MX", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null;

  const businessName = settings?.business_name || "Mi Empresa";
  const primaryColor = settings?.primary_color || "#4F46E5";
  const footerText = settings?.quotation_footer || "Este documento es una cotización y no representa una factura fiscal.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 80px)" }}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold">Vista previa — {quotation.folio}</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={handleDownload} disabled={downloading}>
              <FileDown className="h-4 w-4 mr-1" /> {downloading ? "Generando..." : "Descargar PDF"}
            </Button>
          </div>
        </DialogHeader>

        {/* Preview body */}
        <div className="p-4 md:p-6 space-y-5 text-sm overflow-y-auto flex-1">
          {/* Header */}
          <div className="rounded-xl p-5 text-white flex justify-between items-start" style={{ backgroundColor: primaryColor }}>
            <div className="flex items-start gap-3">
              {settings?.logo_url && (
                <img src={settings.logo_url} alt="Logo" className="h-14 w-14 object-contain rounded-lg bg-white/10 p-1 shrink-0" />
              )}
              <div>
                <p className="text-xl font-bold">{businessName}</p>
                {settings?.address && <p className="text-white/75 text-xs mt-1">{settings.address}</p>}
                {settings?.phone && <p className="text-white/75 text-xs">Tel: {settings.phone}</p>}
                {settings?.rfc && <p className="text-white/75 text-xs">RFC: {settings.rfc}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tracking-wide">COTIZACIÓN</p>
              <p className="text-indigo-200 font-mono">{quotation.folio}</p>
            </div>
          </div>

          {/* Client & Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Cliente</p>
              <p className="font-semibold text-slate-800">{quotation.client_name}</p>
              {quotation.client_email && <p className="text-slate-500 text-xs">{quotation.client_email}</p>}
              {quotation.client_phone && <p className="text-slate-500 text-xs">{quotation.client_phone}</p>}
            </div>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Fecha</p>
                <p className="text-slate-700 text-xs">{dateStr}</p>
              </div>
              {validStr && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Vigencia</p>
                  <p className="text-slate-700 text-xs">{validStr}</p>
                </div>
              )}
              {quotation.payment_method && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Forma de pago</p>
                  <p className="text-slate-700 text-xs">{quotation.payment_method}</p>
                </div>
              )}
            </div>
          </div>

          {/* Info note: Precios incluyen IVA */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-[11px] text-blue-700"><strong>ℹ️ Nota:</strong> Los precios mostrados para productos con IVA ya incluyen el impuesto. Ver desglose en la columna de totales.</p>
          </div>

          {/* Items table with IVA breakdown */}
          <div className="rounded-lg overflow-x-auto border border-slate-200">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="text-white" style={{ backgroundColor: primaryColor }}>
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-center w-12">Cant.</th>
                  <th className="px-3 py-2 text-right w-20">Precio unit.</th>
                  <th className="px-3 py-2 text-center w-16">IVA</th>
                  <th className="px-3 py-2 text-right w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {(quotation.items || []).map((item, i) => {
                  const { vat: ivaAmount } = calculateLineVAT(item.total || 0, item.tax_rate);
                  const hasIVA = (item.tax_rate ?? 16) === 16;
                  const totalPrice = item.total || 0;

                  return (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-700">{item.product_name}</td>
                      <td className="px-3 py-2 text-center text-slate-700">{item.quantity}</td>
                      <td className="px-3 py-2 text-right text-slate-700">${fmt(item.unit_price)}</td>
                      <td className="px-3 py-2 text-center">
                        {hasIVA ? (
                          <span className="bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded text-[10px]">
                            ${fmt(ivaAmount)}
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded text-[10px]">Exento</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">${fmt(totalPrice)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Delivery & payment status (converted only) */}
          {quotation.status === "converted" && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-3">Estado de seguimiento</p>
              <div className="flex flex-wrap gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${quotation.in_route ? "bg-blue-100 text-blue-700" : "bg-white border text-slate-400"}`}>
                  <Truck className="h-4 w-4" /> En ruta
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${quotation.delivered ? "bg-emerald-100 text-emerald-700" : "bg-white border text-slate-400"}`}>
                  <CheckCircle2 className="h-4 w-4" /> Entregado
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${quotation.paid ? "bg-green-100 text-green-700" : "bg-white border text-slate-400"}`}>
                  <DollarSign className="h-4 w-4" /> Pagado
                </div>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-1">
              <div className="flex justify-between text-slate-600 text-xs py-1">
                <span>Subtotal (neto)</span>
                <span>${fmt(quotation.subtotal)}</span>
              </div>
              {quotation.tax > 0 && (
                <div className="flex justify-between text-slate-600 text-xs py-1">
                  <span>IVA 16% (desglose)</span>
                  <span className="text-amber-600 font-semibold">${fmt(quotation.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: primaryColor }}>
                <span>TOTAL A PAGAR</span>
                <span>${fmt(quotation.total)}</span>
              </div>
              <div className="text-[10px] text-slate-500 pt-1">
                ✓ {fmt(quotation.subtotal)} + {fmt(quotation.tax)} = {fmt(quotation.total)}
              </div>
            </div>
          </div>

          {/* Cancellation reason */}
          {quotation.status === "cancelled" && quotation.cancellation_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Motivo de cancelación</p>
              <p className="text-red-700 text-xs whitespace-pre-wrap">{quotation.cancellation_reason}</p>
            </div>
          )}

          {/* Notes */}
          {quotation.notes && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Notas y condiciones</p>
              <p className="text-slate-600 text-xs whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="rounded-lg px-4 py-3 text-center text-white text-xs space-y-1" style={{ backgroundColor: primaryColor }}>
            <p>{footerText}</p>
            <p className="opacity-75">{businessName} · Gracias por su preferencia</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}