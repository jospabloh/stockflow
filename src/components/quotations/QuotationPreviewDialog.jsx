import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, X } from "lucide-react";
import { generateQuotationPDF } from "./QuotationPDF";

function fmt(n) {
  return (n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuotationPreviewDialog({ quotation, settings, open, onOpenChange }) {
  if (!quotation) return null;

  const dateStr = new Date(quotation.created_date || Date.now()).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const validStr = quotation.valid_until
    ? new Date(quotation.valid_until + "T12:00:00").toLocaleDateString("es-MX", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null;

  const businessName = settings?.business_name || "Mi Empresa";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold">Vista previa — {quotation.folio}</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => generateQuotationPDF(quotation, settings)}>
              <FileDown className="h-4 w-4 mr-1" /> Descargar PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Preview body */}
        <div className="p-6 space-y-5 text-sm">
          {/* Header */}
          <div className="bg-indigo-600 rounded-xl p-5 text-white flex justify-between items-start">
            <div>
              <p className="text-xl font-bold">{businessName}</p>
              {settings?.address && <p className="text-indigo-200 text-xs mt-1">{settings.address}</p>}
              {settings?.phone && <p className="text-indigo-200 text-xs">Tel: {settings.phone}</p>}
              {settings?.rfc && <p className="text-indigo-200 text-xs">RFC: {settings.rfc}</p>}
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

          {/* Items table */}
          <div className="rounded-lg overflow-hidden border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-indigo-600 text-white">
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-right w-16">Cant.</th>
                  <th className="px-3 py-2 text-right w-24">Precio unit.</th>
                  <th className="px-3 py-2 text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {(quotation.items || []).map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 text-slate-700">{item.product_name}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{item.quantity}</td>
                    <td className="px-3 py-2 text-right text-slate-700">${fmt(item.unit_price)}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">${fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1">
              <div className="flex justify-between text-slate-600 text-xs py-1">
                <span>Subtotal</span>
                <span>${fmt(quotation.subtotal)}</span>
              </div>
              {quotation.tax > 0 && (
                <div className="flex justify-between text-slate-600 text-xs py-1">
                  <span>{quotation.tax_label || "IVA"} ({quotation.tax_rate || 16}%)</span>
                  <span>${fmt(quotation.tax)}</span>
                </div>
              )}
              <div className="flex justify-between bg-indigo-600 text-white font-bold text-sm px-3 py-2 rounded-lg">
                <span>TOTAL</span>
                <span>${fmt(quotation.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Notas y condiciones</p>
              <p className="text-slate-600 text-xs whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="bg-indigo-600 rounded-lg px-4 py-2 text-center text-white text-xs">
            <p>Este documento es una cotización y no representa una factura fiscal.</p>
            <p>{businessName} · Gracias por su preferencia</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}