import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Pencil, FileDown, ShoppingCart, DollarSign, XCircle, MoreHorizontal, AlertTriangle, Truck, CheckCircle2, ChevronDown, RotateCcw } from "lucide-react";
import moment from "moment";
import ColumnFilterPopover from "@/components/tables/ColumnFilterPopover";

function QuotationRow({ q, statusConfig, onEdit, onPreview, onDownloadPDF, onConvert, onCancel, onPay, onPartialReturn, onInvoiceStatusChange, onInRouteChange, isExpired, onRegenerate }) {
  const status = statusConfig[q.status] || statusConfig.draft;

  return (
    <div className="flex items-center border-b border-border hover:bg-muted/40 transition-colors px-4 py-3">
      {/* Folio */}
      <div className="w-24">
        <button type="button"
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
        {q.total === 0 ? (
          <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-0.5 rounded-full font-medium">
            Muestra / Interno
          </span>
        ) : (
          `$${q.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
        )}
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
          <button type="button"
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
                <button type="button"
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
          q.total === 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-0.5 rounded-full font-medium">
              Sin cargo
            </span>
          ) : (() => {
            const isPaid = q.paid && q.payment_method && !["Por definir", "Pendiente de confirmar", ""].includes(q.payment_method);
            // Derive payment label from payments array if available
            const payments = Array.isArray(q.payments) && q.payments.length > 0 ? q.payments : null;
            const uniqueMethods = payments ? [...new Set(payments.map(p => p.payment_method).filter(Boolean))] : null;
            let payLabel;
            if (isPaid && uniqueMethods) {
              payLabel = uniqueMethods.length > 1 ? "Varios" : uniqueMethods[0].substring(0, 7);
            } else if (isPaid) {
              payLabel = q.payment_method.substring(0, 6);
            } else if (q.delivered && !q.paid) {
              payLabel = "¡Cobrar!";
            } else if (payments && !q.paid) {
              // Has partial payments but not fully paid
              payLabel = "Parcial";
            } else {
              payLabel = "Pago";
            }
            const hasPartial = payments && !q.paid;
            return (
              <button type="button"
                onClick={() => { if (!isPaid) onPay(q); }}
                className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-1 rounded transition-colors ${
                  isPaid
                    ? "bg-green-100 text-green-700 cursor-default"
                    : q.delivered && !q.paid
                      ? "bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer animate-pulse"
                      : hasPartial
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer"
                        : "bg-slate-100 text-slate-400 hover:bg-green-50 hover:text-green-500"
                }`}
                title={
                  isPaid && uniqueMethods?.length > 1 ? uniqueMethods.join(", ") :
                  q.delivered && !q.paid ? "⚠️ Entregado sin cobrar — requiere seguimiento" :
                  hasPartial ? `Pagado parcial: $${(q.amount_paid||0).toLocaleString("es-MX",{minimumFractionDigits:2})} de $${(q.total||0).toLocaleString("es-MX",{minimumFractionDigits:2})}` :
                  undefined
                }
              >
                <DollarSign className="h-3 w-3" />
                {payLabel}
              </button>
            );
          })()
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
            {q.status === "draft" && (
              <>
                <DropdownMenuItem onClick={() => onEdit(q)}>
                  <Pencil className="h-3 w-3 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRegenerate(q)} className="text-indigo-600 focus:text-indigo-600">
                  <RotateCcw className="h-3 w-3 mr-2" /> Re-generar
                </DropdownMenuItem>
              </>
            )}
            {(q.status === "sent" || q.status === "accepted") && (
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
            {q.status === "converted" && !q.paid && q.total > 0 && (
              <DropdownMenuItem onClick={() => onPay(q)}>
                <DollarSign className="h-3 w-3 mr-2" /> Pago
              </DropdownMenuItem>
            )}
            {q.status === "converted" && onPartialReturn && (
              <DropdownMenuItem onClick={() => onPartialReturn(q)} className="text-orange-600 focus:text-orange-600">
                <RotateCcw className="h-3 w-3 mr-2" /> Devolución parcial
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
}

function QuotationCard({ q, statusConfig, onEdit, onPreview, onDownloadPDF, onConvert, onCancel, onPay, onPartialReturn, onInRouteChange, isExpired, onRegenerate }) {
  const status = statusConfig[q.status] || statusConfig.draft;
  const expired = isExpired(q);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Top row: folio + status + actions */}
      <div className="flex items-center justify-between">
        <button type="button"
          onClick={() => onPreview(q)}
          className="font-mono text-sm font-bold text-indigo-600 hover:underline flex items-center gap-1"
        >
          {q.folio}
          {q.delivered && !q.paid && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
        </button>
        <div className="flex items-center gap-2">
          {expired ? (
            <Badge className="bg-red-100 text-red-700 border-0 text-xs">Vencida</Badge>
          ) : (
            <Badge className={`${status.color} border-0 text-xs`}>{status.label}</Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-sm">
              <DropdownMenuItem onClick={() => onPreview(q)}>
                <FileDown className="h-3.5 w-3.5 mr-2" /> Ver cotización
              </DropdownMenuItem>
              {q.status === "draft" && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(q)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRegenerate(q)} className="text-indigo-600">
                    <RotateCcw className="h-3.5 w-3.5 mr-2" /> Re-generar
                  </DropdownMenuItem>
                </>
              )}
              {(q.status === "sent" || q.status === "accepted") && (
                <DropdownMenuItem onClick={() => onEdit(q)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDownloadPDF(q)}>
                <FileDown className="h-3.5 w-3.5 mr-2" /> PDF
              </DropdownMenuItem>
              {(q.status === "draft" || q.status === "sent" || q.status === "accepted") && (
                <DropdownMenuItem onClick={() => { if (!expired) onConvert(q); }}>
                  <ShoppingCart className="h-3.5 w-3.5 mr-2" /> Convertir en venta
                </DropdownMenuItem>
              )}
              {q.status === "converted" && !q.paid && q.total > 0 && (
                <DropdownMenuItem onClick={() => onPay(q)}>
                  <DollarSign className="h-3.5 w-3.5 mr-2" /> Confirmar pago
                </DropdownMenuItem>
              )}
              {q.status === "converted" && onPartialReturn && (
                <DropdownMenuItem onClick={() => onPartialReturn(q)} className="text-orange-600">
                  <RotateCcw className="h-3.5 w-3.5 mr-2" /> Devolución parcial
                </DropdownMenuItem>
              )}
              {q.status !== "cancelled" && (
                <DropdownMenuItem className="text-red-600" onClick={() => onCancel(q)}>
                  <XCircle className="h-3.5 w-3.5 mr-2" /> {q.status === "converted" ? "Anular" : "Cancelar"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Client + date */}
      <div className="flex items-center justify-between">
        <p className="font-medium text-foreground text-sm truncate max-w-[60%]">{q.client_name}</p>
        <span className="text-muted-foreground text-xs">{moment(q.created_date).format("DD/MM/YY")}</span>
      </div>

      {/* Total + tracking */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-foreground text-base">
          {q.total === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-0.5 rounded-full font-medium">
              Muestra / Interno
            </span>
          ) : (
            `$${q.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
          )}
        </span>
        {q.status === "converted" && (
          <div className="flex gap-1.5">
            <button type="button"
              onClick={() => onInRouteChange(q, q.in_route && !q.delivered ? "none" : "in_route")}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium transition-colors ${q.in_route && !q.delivered ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}
            >
              <Truck className="h-3 w-3" /> Ruta
            </button>
            <button type="button"
              onClick={() => onInRouteChange(q, q.delivered ? "none" : "delivered")}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium transition-colors ${q.delivered ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
            >
              <CheckCircle2 className="h-3 w-3" /> Entregado
            </button>
            {q.total === 0 ? (
              <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-1 rounded-lg font-medium">
                Sin cargo
              </span>
            ) : (() => {
              const isPaid = q.paid && q.payment_method && !["Por definir", "Pendiente de confirmar", ""].includes(q.payment_method);
              const payments = Array.isArray(q.payments) && q.payments.length > 0 ? q.payments : null;
              const uniqueMethods = payments ? [...new Set(payments.map(p => p.payment_method).filter(Boolean))] : null;
              const hasPartial = payments && !q.paid;
              let label;
              if (isPaid && uniqueMethods?.length > 1) label = "Varios métodos";
              else if (isPaid) label = "Pagado";
              else if (hasPartial) label = "Pago parcial";
              else label = "Cobrar";
              return (
                <button type="button"
                  onClick={() => { if (!isPaid) onPay(q); }}
                  title={isPaid && uniqueMethods?.length > 1 ? uniqueMethods.join(", ") : hasPartial ? `$${(q.amount_paid||0).toLocaleString("es-MX",{minimumFractionDigits:2})} de $${(q.total||0).toLocaleString("es-MX",{minimumFractionDigits:2})}` : undefined}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium transition-colors ${isPaid ? "bg-green-100 text-green-700" : q.delivered && !q.paid ? "bg-red-100 text-red-700 animate-pulse" : hasPartial ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}
                >
                  <DollarSign className="h-3 w-3" /> {label}
                </button>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VirtualizedQuotationTable({
  quotations,
  statusConfig,
  onEdit,
  onPreview,
  onDownloadPDF,
  onConvert,
  onCancel,
  onPay,
  onPartialReturn,
  onInvoiceStatusChange,
  onInRouteChange,
  isExpired,
  onRegenerate,
  // Filtros tipo Excel
  filters,
  onFiltersChange,
  paymentMethodOptions,
}) {
  const commonProps = { statusConfig, onEdit, onPreview, onDownloadPDF, onConvert, onCancel, onPay, onPartialReturn, onInvoiceStatusChange, onInRouteChange, isExpired, onRegenerate };

  const statusOptions = Object.entries(statusConfig).map(([value, cfg]) => ({
    value,
    label: cfg.label,
    color: cfg.dot,
  }));

  if (quotations.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center text-muted-foreground">
        Sin cotizaciones para los filtros seleccionados
      </div>
    );
  }

  return (
    <>
      {/* Mobile: card list */}
      <div className="flex flex-col gap-3 lg:hidden">
        {quotations.map((q) => (
          <QuotationCard key={q.id} q={q} {...commonProps} />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden lg:block bg-card rounded-2xl shadow-sm border border-border">
        {/* Header con filtros por columna */}
        <div className="flex items-center px-4 py-2.5 bg-muted/40 border-b border-border sticky top-0 z-10">
          <div className="w-24">
            <span className="text-[11px] font-semibold text-muted-foreground">Folio</span>
          </div>

          <div className="flex-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Cliente</span>
          </div>

          <div className="w-20 text-center">
            <ColumnFilterPopover
              label="Fecha"
              type="daterange"
              selected={filters?.dateRange || { from: "", to: "" }}
              onChange={(val) => onFiltersChange({ ...filters, dateRange: val })}
            />
          </div>

          <div className="w-28 text-right">
            <span className="text-[11px] font-semibold text-muted-foreground">Total</span>
          </div>

          <div className="w-28">
            <ColumnFilterPopover
              label="Estado"
              type="multiselect"
              options={statusOptions}
              selected={filters?.statuses || new Set()}
              onChange={(val) => onFiltersChange({ ...filters, statuses: val })}
            />
          </div>

          <div className="w-24 text-center">
            <span className="text-[11px] font-semibold text-muted-foreground">Factura</span>
          </div>

          <div className="w-32 text-center">
            <span className="text-[11px] font-semibold text-muted-foreground">Seguimiento</span>
          </div>

          <div className="w-24 text-center">
            <ColumnFilterPopover
              label="Pago"
              type="multiselect"
              options={paymentMethodOptions || []}
              selected={filters?.paymentMethods || new Set()}
              onChange={(val) => onFiltersChange({ ...filters, paymentMethods: val })}
            />
          </div>

          <div className="w-12 text-center">
            <span className="text-[11px] font-semibold text-muted-foreground">···</span>
          </div>
        </div>

        {/* Rows */}
        <div>
          {quotations.map((q) => (
            <QuotationRow key={q.id} q={q} {...commonProps} />
          ))}
        </div>
      </div>
    </>
  );
}