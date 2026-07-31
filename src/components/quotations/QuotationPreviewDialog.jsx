import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Truck, CheckCircle2, DollarSign, ShoppingCart, Package, Link, Check, EyeOff } from "lucide-react";
import { generateQuotationPDF } from "./QuotationPDF";
import { getDisplayUnitPrice } from "@/lib/vatCalculator";
import CreateFromOnDemandModal from "./CreateFromOnDemandModal";
import QuotationPaymentsSection from "./QuotationPaymentsSection";
import { usePermissions } from "@/lib/PermissionContext";

function fmt(n) {
  return (n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuotationPreviewDialog({ quotation, settings, client, open, onOpenChange, onOnDemandCreated, onQuotationUpdated }) {
  const { can } = usePermissions();
  const [downloading, setDownloading] = useState(false);
  const [createOnDemand, setCreateOnDemand] = useState(null); // { item, itemIndex }
  const [localQuotation, setLocalQuotation] = useState(null);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Only sync from parent when the dialog opens or when the folio changes (new quotation)
  React.useEffect(() => {
    if (open) setLocalQuotation(quotation);
  }, [open, quotation?.id]);

  const rawQ = localQuotation || quotation;
  if (!open || !rawQ) return null;
  // Normalize balance/amount_paid for legacy quotations that may lack these fields
  const q = {
    ...rawQ,
    amount_paid: rawQ.amount_paid ?? (rawQ.paid ? (rawQ.total || 0) : 0),
    balance: rawQ.balance ?? ((rawQ.paid ? 0 : (rawQ.total || 0)) - (rawQ.amount_paid ?? 0)),
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await generateQuotationPDF(q, settings, client);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (q.public_link_enabled && q.public_token) {
      const link = `${window.location.origin}/q/${q.public_token}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    setSharingLoading(true);
    try {
      const token = crypto.randomUUID();
      await base44.entities.Quotation.update(q.id, { public_token: token, public_link_enabled: true });
      setLocalQuotation(prev => ({ ...(prev || q), public_token: token, public_link_enabled: true }));
      onQuotationUpdated?.({ ...q, public_token: token, public_link_enabled: true });
      const link = `${window.location.origin}/q/${token}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleDisableShare = async () => {
    setSharingLoading(true);
    try {
      await base44.entities.Quotation.update(q.id, { public_link_enabled: false });
      setLocalQuotation(prev => ({ ...(prev || q), public_link_enabled: false }));
      onQuotationUpdated?.({ ...q, public_link_enabled: false });
    } finally {
      setSharingLoading(false);
    }
  };

  const dateStr = new Date(q.created_date || Date.now()).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const validStr = q.valid_until
    ? new Date(q.valid_until + "T12:00:00").toLocaleDateString("es-MX", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null;

  const businessName = settings?.business_name || "Mi Empresa";
  const primaryColor = settings?.primary_color || "#4F46E5";
  const footerText = settings?.quotation_footer || "Este documento es una cotización y no representa una factura fiscal.";
  const canCreateFromOnDemand = q.status === "converted" || q.status === "accepted";

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold">Vista previa — {q.folio}</DialogTitle>
          <div className="flex gap-2">
            {can('Cotizaciones', 'share') && (
            <Button size="sm" variant="outline" onClick={handleShare} disabled={sharingLoading}>
              {copied ? <Check className="h-4 w-4 mr-1 text-green-600" /> : <Link className="h-4 w-4 mr-1" />}
              {copied ? "¡Copiado!" : q.public_link_enabled ? "Copiar enlace" : "Compartir enlace"}
            </Button>
            )}
            {can('Cotizaciones', 'share') && q.public_link_enabled && (
              <Button size="sm" variant="ghost" title="Desactivar enlace público" onClick={handleDisableShare} disabled={sharingLoading}>
                <EyeOff className="h-4 w-4" />
              </Button>
            )}
            {can('Cotizaciones', 'export') && (
            <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={handleDownload} disabled={downloading}>
              <FileDown className="h-4 w-4 mr-1" /> {downloading ? "Generando..." : "Descargar PDF"}
            </Button>
            )}
          </div>
        </DialogHeader>

        {/* Preview body */}
        <div className="p-4 md:p-6 space-y-5 text-sm">
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
              <p className="text-brand-200 font-mono">{q.folio}</p>
            </div>
          </div>

          {/* Client & Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Cliente</p>
              <p className="font-semibold text-slate-800">{q.client_name}</p>
              {q.client_email && <p className="text-slate-500 text-xs">{q.client_email}</p>}
              {q.client_phone && <p className="text-slate-500 text-xs">{q.client_phone}</p>}
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
              {q.payment_method && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Forma de pago</p>
                  <p className="text-slate-700 text-xs">{q.payment_method}</p>
                </div>
              )}
            </div>
          </div>

          {/* Info note: Precio unitario neto + IVA desglosado */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-[11px] text-blue-700"><strong>ℹ️ Nota:</strong> El precio unitario se muestra sin IVA cuando aplica. El IVA se desglosa por renglón en su columna.</p>
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
                  <th className="px-3 py-2 text-center w-16">IVA/u.</th>
                  <th className="px-3 py-2 text-right w-20">Total</th>
                  {canCreateFromOnDemand && <th className="px-3 py-2 w-28"></th>}
                </tr>
              </thead>
              <tbody>
                {(q.items || []).map((item, i) => {
                  const taxRate = Number(item.tax_rate ?? 0);
                  const hasTax = taxRate > 0;
                  const totalPrice = item.total || 0;
                  const displayUnitPrice = getDisplayUnitPrice(item.unit_price, item.tax_rate);
                  // IVA por unidad (igual que precio unit. se muestra por unidad)
                  const ivaPerUnit = hasTax ? displayUnitPrice * 0.16 : 0;
                  const isPendingOnDemand = item.is_on_demand && item.on_demand_status === "pending";
                  const isCreatedOnDemand = item.is_on_demand && item.on_demand_status === "product_created";

                  return (
                    <tr key={i} className={item.is_on_demand ? "bg-orange-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="flex flex-col gap-0.5">
                          <span>{item.product_name}</span>
                          {item.is_on_demand && (
                            <span className="inline-flex items-center gap-1 w-fit bg-orange-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                              <ShoppingCart className="h-2 w-2" />
                              {isPendingOnDemand ? "Bajo pedido" : "Creado ✓"}
                            </span>
                          )}
                          {item.product_description && (
                            <span className="text-[10px] text-slate-400 italic">{item.product_description}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-700 tabular">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</td>
                      <td className="px-3 py-2 text-right text-slate-700 tabular">${fmt(displayUnitPrice)}</td>
                      <td className="px-3 py-2 text-center">
                        {hasTax ? (
                          <span className="bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded text-[10px] tabular">
                            ${fmt(ivaPerUnit)}
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded text-[10px]">IVA 0%</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800 tabular">${fmt(totalPrice)}</td>
                      {canCreateFromOnDemand && (
                        <td className="px-3 py-2 text-center">
                          {isPendingOnDemand && (
                            <Button
                              size="sm"
                              type="button"
                              className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] h-7 px-2"
                              onClick={() => setCreateOnDemand({ item, itemIndex: i })}
                            >
                              <Package className="h-3 w-3 mr-1" /> Crear
                            </Button>
                          )}
                          {isCreatedOnDemand && (
                            <span className="text-emerald-600 text-[10px] font-semibold">✓ En catálogo</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Delivery & payment status (converted only) */}
          {q.status === "converted" && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-3">Estado de seguimiento</p>
              <div className="flex flex-wrap gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${q.in_route ? "bg-blue-100 text-blue-700" : "bg-white border text-slate-400"}`}>
                  <Truck className="h-4 w-4" /> En ruta
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${q.delivered ? "bg-emerald-100 text-emerald-700" : "bg-white border text-slate-400"}`}>
                  <CheckCircle2 className="h-4 w-4" /> Entregado
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${q.paid ? "bg-green-100 text-green-700" : "bg-white border text-slate-400"}`}>
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
                <span className="font-mono tabular">${fmt(q.subtotal)}</span>
              </div>
              {q.tax > 0 && (
                <div className="flex justify-between text-slate-600 text-xs py-1">
                  <span>IVA 16% (desglose)</span>
                  <span className="text-amber-600 font-semibold font-mono tabular">${fmt(q.tax)}</span>
                </div>
              )}
              {client?.force_purchase_all_products && q.items?.length > 0 && (
                <div className="flex justify-between text-slate-600 text-xs py-1">
                  <span>Transporte</span>
                  <span className="font-mono tabular">${fmt(20 * q.items.length)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: primaryColor }}>
                <span>TOTAL A PAGAR</span>
                <span className="font-mono tabular">${fmt(q.total)}</span>
              </div>
              <div className="text-[10px] text-slate-500 pt-1">
                ✓ {fmt(q.subtotal)} + {fmt(q.tax)} = {fmt(q.total)}
              </div>
            </div>
          </div>

          {/* Payments section — visible for converted/accepted, hidden for force_zero_price / total === 0 */}
          {(q.status === "converted" || q.status === "accepted") && (
            (q.total || 0) === 0 || client?.force_zero_price ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                  🎁 Muestra / Interno · Sin cargo
                </span>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-3">Pagos</p>
                <QuotationPaymentsSection
                  quotation={q}
                  onPaymentRegistered={() => {
                    base44.entities.Quotation.get(q.id).then(updated => {
                      if (updated) {
                        setLocalQuotation(updated);
                        onQuotationUpdated?.(updated);
                      }
                    }).catch(() => {});
                  }}
                />
              </div>
            )
          )}

          {/* Cancellation reason */}
          {q.status === "cancelled" && q.cancellation_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Motivo de cancelación</p>
              <p className="text-red-700 text-xs whitespace-pre-wrap">{q.cancellation_reason}</p>
            </div>
          )}

          {/* Notes */}
          {q.notes && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Notas y condiciones</p>
              <p className="text-slate-600 text-xs whitespace-pre-wrap">{q.notes}</p>
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

    {createOnDemand && (
      <CreateFromOnDemandModal
        open={!!createOnDemand}
        onOpenChange={(v) => !v && setCreateOnDemand(null)}
        quotation={q}
        item={createOnDemand.item}
        itemIndex={createOnDemand.itemIndex}
        onSuccess={() => {
          base44.entities.Quotation.get(q.id).then(updated => {
            if (updated) setLocalQuotation(updated);
          }).catch(() => {});
          onOnDemandCreated?.();
          setCreateOnDemand(null);
        }}
      />
    )}
    </>
  );
}