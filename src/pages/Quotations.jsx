import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { useBusinessContext } from "@/components/BusinessContext";
import { useQuotations, useInvalidateEntities } from "@/hooks/queries";
import { LoadingOverlay } from "@/components/ui/spinner";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // usado en dialogs de pago/conversión


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


import { Plus, Banknote, Coins, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { generateQuotationPDF } from "@/components/quotations/QuotationPDF";
import QuotationPreviewDialog from "@/components/quotations/QuotationPreviewDialog";
import PartialReturnDialog from "@/components/quotations/PartialReturnDialog";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import VirtualizedQuotationTable, { derivePaymentState } from "@/components/tables/VirtualizedQuotationTable";
import OnDemandPendingPanel from "@/components/quotations/OnDemandPendingPanel";
import QuotationsFinancialSummaryBar from "@/components/quotations/QuotationsFinancialSummaryBar";

const statusConfig = {
  draft: { label: "Borrador", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400", desc: "Cotización en edición" },
  sent: { label: "Enviada", color: "bg-blue-100 text-blue-700", dot: "bg-blue-400", desc: "Enviada al cliente" },
  accepted: { label: "Aceptada", color: "bg-amber-100 text-amber-700", dot: "bg-amber-400", desc: "Aceptada por cliente" },
  converted: { label: "Concretada", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", desc: "Convertida en venta" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700", dot: "bg-red-500", desc: "Cancelada/Anulada" },
};

const isExpired = (q) => {
  if (!q.valid_until || q.status === "converted" || q.status === "cancelled") return false;
  // Comparar solo fechas como strings YYYY-MM-DD para evitar problemas de zona horaria
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD en hora local
  return q.valid_until < todayStr;
};

export default function Quotations() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();
  const { canSee } = useFieldVisibility("Cotizaciones");
  const { businessId, user } = useBusinessContext();
  const userRole = user?.role || null;
  const canRevertPayment = can("Cotizaciones:revert_payment") || userRole === "admin";
  const invalidate = useInvalidateEntities();
  const quotationsQuery = useQuotations(businessId);
  const quotations = quotationsQuery.data ?? [];
  const loading = !businessId || quotationsQuery.isLoading;
  const refreshing = quotationsQuery.isFetching && !quotationsQuery.isLoading;
  const [convertQuotation, setConvertQuotation] = useState(null);
  const [convertPaymentMethod, setConvertPaymentMethod] = useState("");
  const [convertError, setConvertError] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [cancelQuotation, setCancelQuotation] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [payQuotation, setPayQuotation] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [payMarkDelivered, setPayMarkDelivered] = useState(false);
  const [previewQuotation, setPreviewQuotation] = useState(null);
  const [previewClient, setPreviewClient] = useState(null);
  const [returnQuotation, setReturnQuotation] = useState(null);
  const [settings, setSettings] = useState(null);
  const [paymentMethodsCatalog, setPaymentMethodsCatalog] = useState([]);
  // Filtros tipo Excel — estado centralizado
  const [tableFilters, setTableFilters] = useState({
    folioSearch: "",
    clientSearch: "",
    statuses: new Set(),
    invoiceStatuses: new Set(),
    paymentStates: new Set(),
    paymentMethods: new Set(),
    dateRange: { from: "", to: "" },
  });

  useEffect(() => {
    if (!businessId) return;
    base44.entities.AppSettings.filter({ business_id: businessId }).then(s => setSettings(s[0] || null)).catch(() => {});
    base44.entities.PaymentMethod.filter({ business_id: businessId, active: true }).then(setPaymentMethodsCatalog).catch(() => setPaymentMethodsCatalog([]));
  }, [businessId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get("status");
    if (status) setTableFilters(f => ({ ...f, statuses: new Set([status]) }));
  }, [location.search]);

  // Cada filtro es una función independiente para poder componer "todos menos uno"
  // al calcular las sugerencias de autocompletar (ver folioSuggestions/clientSuggestions).
  const folioQ = tableFilters.folioSearch?.trim().toLowerCase();
  const clientQ = tableFilters.clientSearch?.trim().toLowerCase();
  const matchFolio = (q) => !folioQ || q.folio?.toLowerCase().includes(folioQ);
  const matchClient = (q) => !clientQ || q.client_name?.toLowerCase().includes(clientQ);
  const matchStatus = (q) => tableFilters.statuses.size === 0 || tableFilters.statuses.has(q.status);
  const matchInvoiceStatus = (q) => tableFilters.invoiceStatuses.size === 0 || tableFilters.invoiceStatuses.has(q.invoice_status || "");
  const matchPaymentState = (q) => tableFilters.paymentStates.size === 0 || tableFilters.paymentStates.has(derivePaymentState(q));
  const matchDate = (q) => {
    const { from, to } = tableFilters.dateRange;
    if (!from && !to) return true;
    const dateStr = q.created_date ? q.created_date.substring(0, 10) : "";
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  };

  const filtered = quotations.filter((q) =>
    matchFolio(q) && matchClient(q) && matchStatus(q) && matchInvoiceStatus(q) && matchPaymentState(q) && matchDate(q)
  );

  // Sugerencias de autocompletar: opciones visibles si ignoramos solo el propio
  // campo de texto que se está escribiendo — reflejan "lo que se ve en la lista"
  // respetando los demás filtros activos (estado, fecha, factura, pago).
  const folioSuggestions = useMemo(() => {
    const pool = quotations.filter((q) => matchClient(q) && matchStatus(q) && matchInvoiceStatus(q) && matchPaymentState(q) && matchDate(q));
    return [...new Set(pool.map((q) => q.folio).filter(Boolean))].sort();
  }, [quotations, clientQ, tableFilters.statuses, tableFilters.invoiceStatuses, tableFilters.paymentStates, tableFilters.dateRange]);

  const clientSuggestions = useMemo(() => {
    const pool = quotations.filter((q) => matchFolio(q) && matchStatus(q) && matchInvoiceStatus(q) && matchPaymentState(q) && matchDate(q));
    return [...new Set(pool.map((q) => q.client_name).filter(Boolean))].sort();
  }, [quotations, folioQ, tableFilters.statuses, tableFilters.invoiceStatuses, tableFilters.paymentStates, tableFilters.dateRange]);

  const activeFiltersCount = [
    tableFilters.folioSearch?.trim(),
    tableFilters.clientSearch?.trim(),
    tableFilters.statuses.size > 0,
    tableFilters.invoiceStatuses.size > 0,
    tableFilters.paymentStates.size > 0,
    tableFilters.dateRange.from || tableFilters.dateRange.to,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setTableFilters({ folioSearch: "", clientSearch: "", statuses: new Set(), invoiceStatuses: new Set(), paymentStates: new Set(), paymentMethods: new Set(), dateRange: { from: "", to: "" } });
  };

  const activePaymentMethodNames = paymentMethodsCatalog.map((pm) => pm.name);
  const hasActivePaymentCatalog = activePaymentMethodNames.length > 0;

  const handleConvertToSale = async (quotationSnapshot, paymentMethodSnapshot) => {
    // Recibe los datos como parámetros para evitar el race condition con el cierre del dialog
    const targetQuotation = quotationSnapshot || convertQuotation;
    const targetPaymentMethod = paymentMethodSnapshot ?? convertPaymentMethod;

    if (!targetQuotation) return;
    if (!targetPaymentMethod.trim()) {
      setConvertError("Debes seleccionar un método de pago para continuar.");
      return;
    }
    if (targetQuotation.status === "converted") {
      setConvertError("Esta cotización ya fue convertida en venta.");
      return;
    }
    if (hasActivePaymentCatalog && !activePaymentMethodNames.includes(targetPaymentMethod.trim())) {
      setConvertError("Debes seleccionar una forma de pago activa del catálogo.");
      return;
    }

    // In-flight guard (P1 — duplicate movements): the conversion takes a few
    // seconds; without this, an impatient user clicking "Confirmar Venta" again
    // fires a second convertQuotationSafe, which previously created a duplicate
    // set of exit movements. Block re-entry while a request is in flight. The
    // backend also enforces idempotency as the source of truth.
    if (isConverting) return;
    setIsConverting(true);

    try {
      const response = await base44.functions.invoke('quotations', { action: 'convertQuotationSafe',
        quotation_id: targetQuotation.id,
        payment_method: targetPaymentMethod
      });

      if (!response.data.success) {
        const errMsg = response.data.error || response.data.message || 'Conversion failed';
        setConvertError(`❌ ${errMsg}`);
        toast.error(`Conversión cancelada: ${errMsg}`);
        return;
      }

      setConvertQuotation(null);
      setConvertPaymentMethod("");
      setConvertError("");
      toast.success("✓ Cotización convertida en venta");
      invalidate("Quotation");
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || "Intenta nuevamente";
      setConvertError(`❌ ${errMsg}`);
      toast.error(`Error en conversión: ${errMsg}`);
    } finally {
      setIsConverting(false);
    }
  };

  const handleCancel = async (quotationSnapshot, reasonSnapshot) => {
    const targetQuotation = quotationSnapshot || cancelQuotation;
    const targetReason = reasonSnapshot ?? cancelReason;

    if (!targetQuotation) return;

    if (targetQuotation.business_id !== businessId) {
      toast.error("No tienes permiso para cancelar esta cotización");
      setCancelQuotation(null);
      return;
    }

    try {
      const response = await base44.functions.invoke('quotations', { action: 'cancelQuotationSafe',
        quotation_id: targetQuotation.id,
        cancellation_reason: targetReason
      });
      
      if (!response.data.success) {
        const errMsg = response.data.error || response.data.message || 'Cancellation failed';
        toast.error(`❌ ${errMsg}`);
        return;
      }

      setCancelQuotation(null);
      setCancelReason("");
      toast.success("✓ Cotización cancelada");
      invalidate("Quotation");
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || "Error inesperado";
      toast.error(`❌ ${errMsg}`);
    }
  };

  const handleConfirmPayment = async (quotationSnapshot, methodSnapshot, deliveredSnapshot) => {
    const targetQuotation = quotationSnapshot || payQuotation;
    const targetMethod = methodSnapshot ?? paymentMethod;
    const targetDelivered = deliveredSnapshot ?? payMarkDelivered;

    if (!targetQuotation) return;
    if (hasActivePaymentCatalog && !activePaymentMethodNames.includes(targetMethod.trim())) {
      toast.error("Debes seleccionar una forma de pago activa del catálogo.");
      return;
    }
    if (targetQuotation.business_id !== businessId) {
      toast.error("No tienes permiso para confirmar el pago de esta cotización");
      setPayQuotation(null);
      return;
    }
    if (targetQuotation.status !== "converted") {
      setPayQuotation(null);
      return;
    }
    try {
      const updates = { paid: true, payment_method: targetMethod };
      if (targetDelivered) { updates.delivered = true; updates.in_route = false; }

      const response = await base44.functions.invoke('quotations', { action: 'updateQuotationFlagsSafe',
        quotation_id: targetQuotation.id,
        updates
      });

      if (!response.data.success) {
        const errMsg = response.data.error || response.data.message || 'Payment confirmation failed';
        toast.error(`❌ ${errMsg}`);
        return;
      }

      setPayQuotation(null);
      setPaymentMethod("");
      setPayMarkDelivered(false);
      toast.success("✓ Pago confirmado");
      invalidate("Quotation");
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || "Error inesperado";
      toast.error(`❌ ${errMsg}`);
    }
  };

  const handleEdit = (q) => {
    navigate(`/Quotations/edit/${q.id}`);
  };

  // Admin-only: revert a mistaken payment confirmation without cancelling the sale.
  const [revertPayQuotation, setRevertPayQuotation] = useState(null);
  const [isRevertingPayment, setIsRevertingPayment] = useState(false);

  const handleRevertPayment = async (quotationSnapshot) => {
    const target = quotationSnapshot || revertPayQuotation;
    if (!target) return;
    if (isRevertingPayment) return;
    setIsRevertingPayment(true);
    try {
      const response = await base44.functions.invoke('quotations', {
        action: 'revertPaymentConfirmationSafe',
        quotation_id: target.id,
      });
      if (!response.data.success) {
        const errMsg = response.data.error || response.data.message || 'No se pudo revertir el pago';
        toast.error(`❌ ${errMsg}`);
        return;
      }
      setRevertPayQuotation(null);
      toast.success('✓ Pago revertido. La venta sigue siendo válida.');
      invalidate("Quotation");
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || "Error inesperado";
      toast.error(`❌ ${errMsg}`);
    } finally {
      setIsRevertingPayment(false);
    }
  };

  const handleRegenerate = async (q) => {
    if (q.status !== "draft") return;
    
    try {
      const response = await base44.functions.invoke('quotations', { action: 'regenerateQuotation',
        quotation_id: q.id
      });

      if (response.data.success) {
        toast.success("✓ Cotización re-generada con precios actualizados");
        invalidate("Quotation");
      } else {
        toast.error(`Error: ${response.data.error || "No se pudo re-generar"}`);
      }
    } catch (error) {
      toast.error(`Error al re-generar: ${error.message}`);
    }
  };

  if (loading) {
    return <TableSkeleton rows={8} columns={8} />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <OnDemandPendingPanel />
      {/* Barra de acciones */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              <X className="h-3 w-3" /> Limpiar filtros
              <span className="bg-red-100 text-red-600 rounded-full px-1.5 text-[10px] font-bold">{activeFiltersCount}</span>
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        {can('Cotizaciones', 'create') && (
          <Button className="bg-brand-600 hover:bg-brand-700 shrink-0" onClick={() => navigate("/Quotations/new")}>
            <Plus className="h-4 w-4 mr-1" /> Nueva Cotización
          </Button>
        )}
      </div>

      {can('Cotizaciones', 'pricing') && (
        <QuotationsFinancialSummaryBar quotations={filtered} totalVisible={filtered.length} />
      )}

      {can('Cotizaciones', 'view') && (
      <div className="relative">
        <LoadingOverlay show={refreshing} />
        <VirtualizedQuotationTable
        quotations={filtered}
        statusConfig={statusConfig}
        filters={tableFilters}
        onFiltersChange={setTableFilters}
        paymentMethodOptions={paymentMethodsCatalog.map(pm => ({ value: pm.name, label: pm.name }))}
        folioSuggestions={folioSuggestions}
        clientSuggestions={clientSuggestions}
        canShowPricing={can('Cotizaciones', 'pricing')}
        canConvert={can('Cotizaciones', 'convert')}
        canCancel={can('Cotizaciones', 'cancel')}
        canConfirmPayment={can('Cotizaciones', 'confirm_payment')}
        canReturn={can('Cotizaciones', 'return')}
        canSend={can('Cotizaciones', 'send')}
        canExport={can('Cotizaciones', 'export')}
        canDelete={can('Cotizaciones', 'delete')}
        canRevertPayment={userRole === 'admin'}
        onRevertPayment={(q) => setRevertPayQuotation(q)}
        onEdit={handleEdit}
        onPreview={async (q) => {
          setPreviewQuotation(q);
          if (q.client_id) {
            base44.entities.Client.list().then(cs => {
              const client = cs.find(c => c.id === q.client_id);
              setPreviewClient(client || null);
            }).catch(() => setPreviewClient(null));
          }
        }}
        onDownloadPDF={async (q) => {
          let client = null;
          if (q.client_id) {
            const clients = await base44.entities.Client.list();
            client = clients.find(c => c.id === q.client_id);
          }
          generateQuotationPDF(q, settings, client);
        }}
        onConvert={(q) => {
          setConvertQuotation(q);
          setConvertPaymentMethod(q.payment_method || "");
          setConvertError("");
        }}
        onCancel={(q) => {
          setCancelQuotation(q);
          setCancelReason("");
        }}
        onPartialReturn={(q) => setReturnQuotation(q)}
        onPay={(q) => {
          setPayQuotation(q);
          setPaymentMethod(q.payment_method || "");
        }}
        onRegenerate={handleRegenerate}
        onInvoiceStatusChange={async (q, val) => {
          try {
            const response = await base44.functions.invoke('quotations', { action: 'updateQuotationFlagsSafe',
              quotation_id: q.id,
              updates: { invoice_status: val }
            });
            if (response.data?.success) {
              invalidate("Quotation");
            } else {
              toast.error(response.data?.error || response.data?.message || "No se pudo actualizar el estado de facturación");
            }
          } catch (err) {
            toast.error(err?.response?.data?.error || err?.message || "No se pudo actualizar el estado de facturación");
          }
        }}
        onInvoiceNumberChange={async (q, val) => {
          try {
            const response = await base44.functions.invoke('quotations', { action: 'updateQuotationFlagsSafe',
              quotation_id: q.id,
              updates: { invoice_number: val }
            });
            if (response.data?.success) {
              invalidate("Quotation");
            } else {
              toast.error(response.data?.error || response.data?.message || "No se pudo actualizar el número de factura");
            }
          } catch (err) {
            toast.error(err?.response?.data?.error || err?.message || "No se pudo actualizar el número de factura");
          }
        }}
        onInRouteChange={async (q, action) => {
          if (action === "delivered") {
            // Use deliverQuotationSafe to handle on-demand EXIT movements
            const response = await base44.functions.invoke('quotations', { action: 'deliverQuotationSafe',
              quotation_id: q.id,
            });
            if (response.data?.warning) {
              toast.error(response.data.message);
              return;
            }
            if (!response.data?.success) {
              toast.error(response.data?.message || response.data?.error || "Error al marcar entregado");
              return;
            }
            toast.success("✓ Pedido marcado como entregado");
            invalidate("Quotation");
          } else {
            let updates;
            if (action === "in_route") {
              updates = { in_route: true, delivered: false };
            } else {
              updates = { in_route: false, delivered: false };
            }
            try {
              const response = await base44.functions.invoke('quotations', { action: 'updateQuotationFlagsSafe',
                quotation_id: q.id,
                updates
              });
              if (response.data?.success) {
                invalidate("Quotation");
              } else {
                toast.error(response.data?.error || response.data?.message || "No se pudo actualizar el estado de seguimiento");
              }
            } catch (err) {
              toast.error(err?.response?.data?.error || err?.message || "No se pudo actualizar el estado de seguimiento");
            }
          }
        }}
        onDeliveredChange={() => {}}
        isExpired={isExpired}
        />
      </div>
        )}

      <PartialReturnDialog
        open={!!returnQuotation}
        onOpenChange={(v) => !v && setReturnQuotation(null)}
        quotation={returnQuotation}
        onSaved={() => invalidate("Quotation")}
      />

      <QuotationPreviewDialog
        quotation={previewQuotation}
        settings={settings}
        client={previewClient}
        open={!!previewQuotation}
        userRole={userRole}
        onOpenChange={(v) => {
          if (!v) {
            invalidate("Quotation");
            setPreviewQuotation(null);
            setPreviewClient(null);
          }
        }}
        onOnDemandCreated={() => invalidate("Quotation")}
        onQuotationUpdated={(updated) => setPreviewQuotation(updated)}
      />

      {/* Cancel dialog */}
      <AlertDialog open={!!cancelQuotation} onOpenChange={(v) => { if (!v) { setCancelQuotation(null); setCancelReason(""); } }}>
        <AlertDialogContent role="alertdialog" aria-labelledby="cancel-title">
          <AlertDialogHeader>
            <AlertDialogTitle id="cancel-title">
              {cancelQuotation?.status === "converted" ? `¿Anular venta ${cancelQuotation?.folio}?` : `¿Cancelar cotización ${cancelQuotation?.folio}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {cancelQuotation?.status === "converted"
                    ? "⚠️ Esta venta ya fue concretada. Al anularla se revertirá el stock de todos los productos. Esta acción no se puede deshacer."
                    : "Esta acción marcará la cotización como cancelada. Por favor indica el motivo."}
                </p>
                {cancelQuotation?.paid &&
                  String(cancelQuotation?.payment_method || "").trim().toLowerCase() === "efectivo" && (
                    <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm text-blue-800 dark:text-blue-300">
                      <Banknote className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>
                        Esta venta fue cobrada en efectivo. El ingreso registrado en caja chica se revertirá automáticamente al anularla.
                      </span>
                    </div>
                  )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Textarea
              placeholder="Razón de cancelación/anulación (requerida)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              onClick={(e) => {
                const q = cancelQuotation;
                const r = cancelReason;
                e.preventDefault();
                handleCancel(q, r);
              }}
              disabled={!cancelReason.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              Confirmar Cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment confirmation dialog */}
      <AlertDialog open={!!payQuotation} onOpenChange={(v) => { if (!v) { setPayQuotation(null); setPaymentMethod(""); setPayMarkDelivered(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pago — {payQuotation?.folio}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Total: <strong className="font-mono tabular">${payQuotation?.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong> · Cliente: {payQuotation?.client_name}</p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm text-blue-800 dark:text-blue-300">
                  💡 <strong>¿Pago parcial o con varios métodos?</strong> Usa el botón de abajo para registrar abonos con diferentes métodos.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-3 space-y-2">
            <p className="text-sm font-medium">Método de pago — pago total</p>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethodsCatalog.map((pm) => (
                <button type="button"
                  key={pm.id || pm.name}
                  onClick={() => setPaymentMethod(pm.name)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === pm.name ? "bg-brand-600 text-white border-brand-600" : "bg-card text-foreground border-border hover:border-brand-300"}`}
                >
                  {pm.name}
                </button>
              ))}
            </div>
            {paymentMethodsCatalog.length === 0 && (
              <p className="text-sm text-amber-600">No hay formas de pago activas en catálogo.</p>
            )}
            <Input
              placeholder="Otro método de pago..."
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-2"
              disabled={paymentMethodsCatalog.length > 0}
            />
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <button type="button"
              onClick={() => {
                const q = payQuotation;
                setPayQuotation(null);
                setPaymentMethod("");
                setPreviewQuotation(q);
                if (q.client_id) {
                  base44.entities.Client.list().then(cs => {
                    setPreviewClient(cs.find(c => c.id === q.client_id) || null);
                  }).catch(() => setPreviewClient(null));
                }
              }}
              className="px-4 py-2 rounded-md text-sm font-medium border border-brand-300 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
            >
              <Coins className="h-4 w-4 mr-1.5" /> Ver pagos parciales
            </button>
            <AlertDialogAction
              onClick={(e) => {
                const q = payQuotation;
                const m = paymentMethod;
                const d = payMarkDelivered;
                e.preventDefault();
                handleConfirmPayment(q, m, d);
              }}
              disabled={!paymentMethod.trim() || (hasActivePaymentCatalog && !activePaymentMethodNames.includes(paymentMethod.trim()))}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              Confirmar Pago Total
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert payment confirmation dialog — admin only */}
      <AlertDialog open={!!revertPayQuotation} onOpenChange={(v) => { if (!v) setRevertPayQuotation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revertir pago — {revertPayQuotation?.folio}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  La venta sigue siendo <strong>válida</strong> (el stock ya fue descontado). Solo se revertirá la
                  confirmación de pago: la cotización quedará como <strong>pendiente de cobro</strong> y cualquier
                  ingreso registrado en caja chica se eliminará.
                </p>
                <p className="text-xs text-muted-foreground">
                  Cliente: {revertPayQuotation?.client_name} · Total: <span className="font-mono tabular">${revertPayQuotation?.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleRevertPayment(revertPayQuotation); }}
              disabled={isRevertingPayment}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
            >
              {isRevertingPayment ? "Revirtiendo…" : "Revertir pago"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert confirmation */}
      <AlertDialog open={!!convertQuotation} onOpenChange={(v) => { if (!v) { setConvertError(""); setConvertPaymentMethod(""); setConvertQuotation(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Convertir en venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se descontará el stock de los {convertQuotation?.items?.length || 0} producto(s) de la cotización {convertQuotation?.folio}. Total: <span className="font-mono tabular">${convertQuotation?.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-3 space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
              💡 Selecciona el método principal. Si el cliente paga con <strong>varios métodos o en parcialidades</strong>, registra los cobros desde la cotización una vez concretada.
            </div>
            <p className="text-sm font-medium">Método de pago <span className="text-red-500">*</span></p>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethodsCatalog.map((pm) => (
                <button
                  key={pm.id || pm.name}
                  type="button"
                  onClick={() => { setConvertPaymentMethod(pm.name); setConvertError(""); }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${convertPaymentMethod === pm.name ? "bg-brand-600 text-white border-brand-600" : "bg-card text-foreground border-border hover:border-brand-300"}`}
                >
                  {pm.name}
                </button>
              ))}
            </div>
            {paymentMethodsCatalog.length === 0 && (
              <p className="text-sm text-amber-600">No hay formas de pago activas en catálogo.</p>
            )}
            <Input
              placeholder="Otro método..."
              value={convertPaymentMethod}
              onChange={(e) => { setConvertPaymentMethod(e.target.value); setConvertError(""); }}
              disabled={paymentMethodsCatalog.length > 0}
            />
            {convertError && <p className="text-sm text-red-600">{convertError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Captura los valores ANTES de que el dialog se cierre (race condition fix)
                const q = convertQuotation;
                const pm = convertPaymentMethod;
                e.preventDefault();
                handleConvertToSale(q, pm);
              }}
              disabled={isConverting || !convertPaymentMethod.trim() || (hasActivePaymentCatalog && !activePaymentMethodNames.includes(convertPaymentMethod.trim()))}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
            >
              {isConverting ? "Procesando…" : "Confirmar Venta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}