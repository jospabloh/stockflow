import React from "react";
import { FixedSizeList as List } from "react-window";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Pencil, FileDown, ShoppingCart, DollarSign, XCircle, MoreHorizontal, AlertTriangle, Truck, CheckCircle2, ChevronDown } from "lucide-react";
import { createButtonProps } from "@/lib/a11y";
import moment from "moment";

const ITEM_HEIGHT = 72;

export default function VirtualizedQuotationTable({
  quotations,
  statusConfig,
  onEdit,
  onPreview,
  onDownloadPDF,
  onConvert,
  onCancel,
  onPay,
  onInvoiceStatusChange,
  onInRouteChange,
  onDeliveredChange,
  isExpired,
}) {
  const QuotationRow = ({ index, style }) => {
    const q = quotations[index];
    const status = statusConfig[q.status] || statusConfig.draft;

    return (
      <div style={style} className="flex items-center border-b border-border hover:bg-muted/40 transition-colors px-4 py-3">
        {/* Folio */}
        <div className="w-24">
          <button
            onClick={() => onPreview(q)}
            className="font-mono text-xs text-indigo-600 cursor-pointer hover:underline flex items-center gap-1"
          >
            {q.folio}
            {q.delivered && !q.paid && <AlertTriangle className="h-3 w-3 text-amber-500" />}
          </button>
        </div>

        {/* Client */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm truncate">{q.client_name}</p>
        </div>

        {/* Date */}
        <div className="w-20 text-muted-foreground text-xs">{moment(q.created_date).format("DD/MM/YY")}</div>

        {/* Total */}
        <div className="w-28 text-right font-semibold text-foreground text-xs">
          ${q.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
        </div>

        {/* Status */}
        <div className="w-28">
          {isExpired(q) ? (
            <Badge className="bg-red-100 text-red-700 border-0 flex items-center gap-1 w-fit text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
              Vencida
            </Badge>
          ) : (
            <Badge className={`${status.color} border-0 flex items-center gap-1 w-fit text-xs`} title={status.desc}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot} inline-block`} />
              {status.label}
            </Badge>
          )}
        </div>

        {/* Invoice Status */}
        <div className="w-24 text-center flex gap-0.5 justify-center flex-wrap">
          {["pendiente", "emitida", "no_requerida"].map((opt) => (
            <button
              key={opt}
              onClick={() => {
                const newVal = q.invoice_status === opt ? null : opt;
                onInvoiceStatusChange(q, newVal);
              }}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-colors border ${
                q.invoice_status === opt
                  ? opt === "pendiente"
                    ? "bg-amber-100 text-amber-700 border-amber-300"
                    : opt === "emitida"
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                      : "bg-slate-100 text-slate-600 border-slate-300"
                  : "bg-transparent text-slate-300 border-slate-200"
              }`}
              title={opt === "pendiente" ? "Pendiente" : opt === "emitida" ? "Emitida" : "No Requerida"}
            >
              {opt === "pendiente" ? "Pte" : opt === "emitida" ? "Emit" : "N/R"}
            </button>
          ))}
        </div>

        {/* Tracking (converted only) */}
        <div className="w-32">
          {q.status === "converted" && (
            <div className="flex items-center justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-1 rounded transition-colors ${
                      q.delivered
                        ? "bg-emerald-100 text-emerald-700"
                        : q.in_route
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-500"
                    }`}
                  >
                    {q.delivered
                      ? <><CheckCircle2 className="h-3 w-3" /> Entregado</>
                      : q.in_route
                        ? <><Truck className="h-3 w-3" /> En ruta</>
                        : <><Truck className="h-3 w-3" /> Ruta</>
                    }
                    <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="text-xs min-w-[130px]">
                  <DropdownMenuItem
                    onClick={() => onInRouteChange(q, "in_route")}
                    className={q.in_route && !q.delivered ? "bg-blue-50 text-blue-700 font-semibold" : ""}
                  >
                    <Truck className="h-3 w-3 mr-2 text-blue-500" /> En ruta
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onInRouteChange(q, "delivered")}
                    className={q.delivered ? "bg-emerald-50 text-emerald-700 font-semibold" : ""}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-2 text-emerald-500" /> Entregado
                  </DropdownMenuItem>
                  {(q.in_route || q.delivered) && (
                    <DropdownMenuItem onClick={() => onInRouteChange(q, "none")} className="text-slate-400">
                      Quitar estado
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Payment (converted only) */}
        <div className="w-24">
          {q.status === "converted" && (
            <button
              onClick={() => {
                const isPaid = q.paid && q.payment_method && !["Por definir", "Pendiente de confirmar", ""].includes(q.payment_method);
                if (!isPaid) onPay(q);
              }}
              className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded transition-colors ${
                q.paid && q.payment_method && !["Por definir", "Pendiente de confirmar", ""].includes(q.payment_method)
                  ? "bg-green-100 text-green-700 cursor-default"
                  : q.delivered && !q.paid
                    ? "bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer animate-pulse"
                    : q.paid
                      ? "bg-orange-100 text-orange-700 hover:bg-orange-200 cursor-pointer"
                      : "bg-slate-100 text-slate-400 hover:bg-green-50 hover:text-green-500"
              }`}
              title={q.delivered && !q.paid ? "⚠️ Entregado sin cobrar — requiere seguimiento" : undefined}
            >
              <DollarSign className="h-3 w-3" />
              {q.paid && q.payment_method && !["Por definir", "Pendiente de confirmar", ""].includes(q.payment_method)
                ? q.payment_method.substring(0, 6)
                : q.delivered && !q.paid
                  ? "¡Cobrar!"
                  : q.paid
                    ? "Confirmar"
                    : "Pago"}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="w-12 text-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              {(q.status === "draft" || q.status === "sent" || q.status === "accepted") && (
                <DropdownMenuItem onClick={() => onEdit(q)}>
                  <Pencil className="h-3 w-3 mr-2" /> Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDownloadPDF(q)}>
                <FileDown className="h-3 w-3 mr-2" /> PDF
              </DropdownMenuItem>
              {(q.status === "draft" || q.status === "sent" || q.status === "accepted") && (
                <DropdownMenuItem
                  onClick={() => {
                    if (isExpired(q)) {
                      alert(`Vencida ${new Date(q.valid_until).toLocaleDateString("es-MX")}`);
                      return;
                    }
                    onConvert(q);
                  }}
                >
                  <ShoppingCart className="h-3 w-3 mr-2" /> Venta
                </DropdownMenuItem>
              )}
              {q.status === "converted" && !q.paid && (
                <DropdownMenuItem onClick={() => onPay(q)}>
                  <DollarSign className="h-3 w-3 mr-2" /> Pago
                </DropdownMenuItem>
              )}
              {q.status !== "cancelled" && (
                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => onCancel(q)}>
                  <XCircle className="h-3 w-3 mr-2" /> {q.status === "converted" ? "Anular" : "Cancelar"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  if (quotations.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center text-muted-foreground">
        Sin cotizaciones
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-3 bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground sticky top-0 z-10">
        <div className="w-24">Folio</div>
        <div className="flex-1">Cliente</div>
        <div className="w-20 text-center">Fecha</div>
        <div className="w-28 text-right">Total</div>
        <div className="w-28">Estado</div>
        <div className="w-24 text-center">Factura</div>
        <div className="w-32 text-center">Seguimiento</div>
        <div className="w-24 text-center">Pago</div>
        <div className="w-12 text-center">Acciones</div>
      </div>

      {/* Virtualized List */}
      <List height={Math.min(quotations.length * ITEM_HEIGHT, 600)} itemCount={quotations.length} itemSize={ITEM_HEIGHT} width="100%">
        {QuotationRow}
      </List>
    </div>
  );
}