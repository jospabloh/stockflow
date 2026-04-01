import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowUpRight } from "lucide-react";
import moment from "moment";

export default function UnpaidDetailModal({ open, onOpenChange, unpaidConverted, unpaidDirectMovements }) {
  const totalQuotations = unpaidConverted.reduce((s, q) => s + (q.total || 0), 0);
  const totalMovements = unpaidDirectMovements.reduce((s, m) => s + (m.total || 0), 0);
  const grandTotal = totalQuotations + totalMovements;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Pendiente por cobrar —{" "}
            <span className="text-orange-600 font-bold">
              ${grandTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-5 pr-1 pt-1">
          {/* Cotizaciones sin cobrar */}
          {unpaidConverted.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                <p className="text-sm font-semibold text-slate-700">
                  Cotizaciones concretadas sin cobrar ({unpaidConverted.length})
                </p>
                <Badge className="ml-auto bg-indigo-100 text-indigo-700 border-0">
                  ${totalQuotations.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {unpaidConverted.map((q) => (
                  <div key={q.id} className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/30 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-700">{q.client_name || "—"}</p>
                      <p className="text-xs text-slate-500">
                        {q.folio ? `Folio ${q.folio} · ` : ""}
                        {moment.utc(q.created_date).local().format("DD/MM/YY")}
                        {q.payment_method ? ` · ${q.payment_method}` : ""}
                      </p>
                    </div>
                    <span className="font-bold text-indigo-700">
                      ${(q.total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Movimientos directos sin cobrar */}
          {unpaidDirectMovements.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="h-4 w-4 text-orange-500" />
                <p className="text-sm font-semibold text-slate-700">
                  Salidas directas sin cobrar ({unpaidDirectMovements.length})
                </p>
                <Badge className="ml-auto bg-orange-100 text-orange-700 border-0">
                  ${totalMovements.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {unpaidDirectMovements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between bg-orange-50 dark:bg-orange-950/30 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-700">{m.product_name || "—"}</p>
                      <p className="text-xs text-slate-500">
                        {m.reason ? `Cliente: ${m.reason} · ` : ""}
                        {moment.utc(m.created_date).local().format("DD/MM/YY HH:mm")}
                        {m.reference ? ` · ${m.reference}` : ""}
                        {` · Cant: ${m.quantity}`}
                      </p>
                    </div>
                    <span className="font-bold text-orange-700">
                      ${(m.total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}