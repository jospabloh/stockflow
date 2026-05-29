import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


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


import { Plus, Search, Banknote, Coins, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { generateQuotationPDF } from "@/components/quotations/QuotationPDF";
import QuotationPreviewDialog from "@/components/quotations/QuotationPreviewDialog";
import PartialReturnDialog from "@/components/quotations/PartialReturnDialog";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import VirtualizedQuotationTable from "@/components/tables/VirtualizedQuotationTable";
import OnDemandPendingPanel from "@/components/quotations/OnDemandPendingPanel";

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
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [convertQuotation, setConvertQuotation] = useState(null);
  const [convertPaymentMethod, setConvertPaymentMethod] = useState("");
  const [convertError, setConvertError] = useState("");
  const [cancelQuotation, setCancelQuotation] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [payQuotation, setPayQuotation] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [payMarkDelivered, setPayMarkDelivered] = useState(false);
  const [previewQuotation, setPreviewQuotation] = useState(null);
  const [previewClient, setPreviewClient] = useState(null);
  const [returnQuotation, setReturnQuotation] = useState(null);
  const [settings, setSettings] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [paymentMethodsCatalog, setPaymentMethodsCatalog] = useState([]);
  // Filtros tipo Excel — estado centralizado
  const [tableFilters, setTableFilters] = useState({
    statuses: new Set(),
    paymentMethods: new Set(),
    dateRange: { from: "", to: "" },
  });

  useEffect(() => {
    base44.auth.me().then(u => {
      setBusinessId(u?.business_id || null);
      setUserRole(u?.role || null);
      base44.entities.AppSettings.filter({ business_id: u?.business_id }).then(s => setSettings(s[0] || null)).catch(() => {});
      base44.entities.PaymentMethod.filter({ business_id: u?.business_id, active: true }).then(setPaymentMethodsCatalog).catch(() => setPaymentMethodsCatalog([]));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get("status");
    if (status) setStatusFilter(status);
  }, [location.search]);

  const loadData = async (bId) => {
    if (!bId) return;
    setLoading(true);
    base44.entities.Quotation.filter({ business_id: bId }, "-created_date", 100).then((q) => {
      setQuotations(q);
      setLoading(false);
    });
  };

  useEffect(() => { if (businessId) loadData(businessId); }, [businessId]);

  const filtered = quotations.filter((q) => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      q.client_name?.toLowerCase().includes(s) ||
      q.folio?.toLowerCase().includes(s) ||
      q.client_email?.toLowerCase().includes(s) ||
      q.client_phone?.toLowerCase().includes(s) ||
      statusConfig[q.status]?.label?.toLowerCase().includes(s);

    // Filtro multi-estado
    const matchStatus = tableFilters.statuses.size === 0 || tableFilters.statuses.has(q.status);

    // Filtro multi-método de pago
    let matchPaymentMethod = true;
    if (tableFilters.paymentMethods.size > 0) {
      const hasPmInPayments = q.payments?.some(p => tableFilters.paymentMethods.has(p.payment_method));
      const hasPmDirect = tableFilters.paymentMethods.has(q.payment_method);
      matchPaymentMethod = hasPmInPayments || hasPmDirect;
    }

    // Filtro rango de fechas (sobre created_date)
    let matchDate = true;
    const { from, to } = tableFilters.dateRange;
    if (from || to) {
      const dateStr = q.created_date ? q.created_date.substring(0, 10) : "";
      if (from && dateStr < from) matchDate = false;
      if (to && dateStr > to) matchDate = false;
    }

    return matchSearch && matchStatus && matchPaymentMethod && matchDate;
  });

  const activeFiltersCount = [
    tableFilters.statuses.size > 0,
    tableFilters.paymentMethods.size > 0,
    tableFilters.dateRange.from || tableFilters.dateRange.to,
    search.trim() !== ""
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearch("");
    setTableFilters({ statuses: new Set(), paymentMethods: new Set(), dateRange: { from: "", to: "" } });
  };

  const activePaymentMethodNames = paymentMethodsCatalog.map((pm) => pm.name);
  const hasActivePaymentCatalog = activePaymentMethodNames.length > 0;

  const handleConvertToSale = async () => {
    if (!convertQuotation) return;
    if (!convertPaymentMethod.trim()) {
      setConvertError("Debes seleccionar un método de pago para continuar.");
      return;
    }
    // Validar que la cotización no esté ya convertida
    if (convertQuotation.status === "converted") {
      setConvertError("Esta cotización ya fue convertida en venta.");
      return;
    }
    if (hasActivePaymentCatalog && !activePaymentMethodNames.includes(convertPaymentMethod.trim())) {
      setConvertError("Debes seleccionar una forma de pago activa del catálogo.");
      return;
    }

    // CRITICAL: Use backend-validated safe function for conversion
    try {
      const response = await base44.functions.invoke('convertQuotationSafe', {
        quotation_id: convertQuotation.id,
        payment_method: convertPaymentMethod
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
      loadData(businessId);
      } catch (error) {
      const errMsg = error.response?.data?.error || error.message || "Intenta nuevamente";
      setConvertError(`❌ ${errMsg}`);
      toast.error(`Error en conversión: ${errMsg}`);
      }
  };

  const handleCancel = async () => {
    if (!cancelQuotation) return;

    // CRITICAL FIX: Validate ownership before cancel
    if (cancelQuotation.business_id !== businessId) {
      toast.error("No tienes permiso para cancelar esta cotización");
      setCancelQuotation(null);
      return;
    }

    // CRITICAL: Use backend-validated safe function for cancellation
    try {
      const response = await base44.functions.invoke('cancelQuotationSafe', {
        quotation_id: cancelQuotation.id,
        cancellation_reason: cancelReason
      });
      
      if (!response.data.success) {
        const errMsg = response.data.error || response.data.message || 'Cancellation failed';
        toast.error(`❌ ${errMsg}`);
        return;
      }

      setCancelQuotation(null);
      setCancelReason("");
      toast.success("✓ Cotización cancelada");
      loadData(businessId);
      } catch (error) {
      const errMsg = error.response?.data?.error || error.message || "Error inesperado";
      toast.error(`❌ ${errMsg}`);
      }
  };

  const handleConfirmPayment = async () => {
   if (!payQuotation) return;
   if (hasActivePaymentCatalog && !activePaymentMethodNames.includes(paymentMethod.trim())) {
     toast.error("Debes seleccionar una forma de pago activa del catálogo.");
     return;
   }
   // CRITICAL FIX: Validate ownership before payment
   if (payQuotation.business_id !== businessId) {
     toast.error("No tienes permiso para confirmar el pago de esta cotización");
     setPayQuotation(null);
     return;
   }
   // Solo permitir confirmar pago si es cotización convertida
   if (payQuotation.status !== "converted") {
     setPayQuotation(null);
     return;
   }
   try {
     // CRITICAL: Use backend-validated safe function for payment confirmation
     const updates = { paid: true, payment_method: paymentMethod };
     if (payMarkDelivered) { updates.delivered = true; updates.in_route = false; }

     const response = await base44.functions.invoke('updateQuotationFlagsSafe', {
       quotation_id: payQuotation.id,
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
     loadData(businessId);
   } catch (error) {
     const errMsg = error.response?.data?.error || error.message || "Error inesperado";
     toast.error(`❌ ${errMsg}`);
   }
  };

  const handleEdit = (q) => {
    navigate(`/Quotations/edit/${q.id}`);
  };

  const handleRegenerate = async (q) => {
    if (q.status !== "draft") return;
    
    try {
      const response = await base44.functions.invoke('regenerateQuotation', {
        quotation_id: q.id
      });

      if (response.data.success) {
        toast.success("✓ Cotización re-generada con precios actualizados");
        loadData(businessId);
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
      {/* Barra de acciones: buscador + nueva cotización */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por cliente, folio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Buscar cotizaciones"
          />
        </div>
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
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>
          {can('Cotizaciones', 'create') && (
            <Button className="bg-indigo-600 hover:bg-indigo-700 shrink-0" onClick={() => navigate("/Quotations/new")}>
              <Plus className="h-4 w-4 mr-1" /> Nueva Cotización
            </Button>
          )}
        </div>
      </div>

      {can('Cotizaciones', 'view') && (
      <VirtualizedQuotationTable
        quotations={filtered}
        statusConfig={statusConfig}
        filters={tableFilters}
        onFiltersChange={setTableFilters}
        paymentMethodOptions={paymentMethodsCatalog.map(pm => ({ value: pm.name, label: pm.name }))}
        canShowPricing={can('Cotizaciones', 'pricing')}
        canConvert={can('Cotizaciones', 'convert')}
        canCancel={can('Cotizaciones', 'cancel')}
        canConfirmPayment={can('Cotizaciones', 'confirm_payment')}
        canReturn={can('Cotizaciones', 'return')}
        canSend={can('Cotizaciones', 'send')}
        canExport={can('Cotizaciones', 'export')}
        canDelete={can('Cotizaciones', 'delete')}
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
          const response = await base44.functions.invoke('updateQuotationFlagsSafe', {
            quotation_id: q.id,
            updates: { invoice_status: val }
          });
          if (response.data.success) loadData(businessId);
        }}
        onInRouteChange={async (q, action) => {
          if (action === "delivered") {
            // Use deliverQuotationSafe to handle on-demand EXIT movements
            const response = await base44.functions.invoke('deliverQuotationSafe', {
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
            loadData(businessId);
          } else {
            let updates;
            if (action === "in_route") {
              updates = { in_route: true, delivered: false };
            } else {
              updates = { in_route: false, delivered: false };
            }
            const response = await base44.functions.invoke('updateQuotationFlagsSafe', {
              quotation_id: q.id,
              updates
            });
            if (response.data.success) loadData(businessId);
          }
        }}
        onDeliveredChange={() => {}}
        isExpired={isExpired}
        />
        )}

      <PartialReturnDialog
        open={!!returnQuotation}
        onOpenChange={(v) => !v && setReturnQuotation(null)}
        quotation={returnQuotation}
        onSaved={() => loadData(businessId)}
      />

      <QuotationPreviewDialog
        quotation={previewQuotation}
        settings={settings}
        client={previewClient}
        open={!!previewQuotation}
        userRole={userRole}
        onOpenChange={(v) => {
          if (!v) {
            loadData(businessId);
            setPreviewQuotation(null);
            setPreviewClient(null);
          }
        }}
        onOnDemandCreated={() => loadData(businessId)}
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
                <p>Total: <strong>${payQuotation?.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong> · Cliente: {payQuotation?.client_name}</p>
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
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === pm.name ? "bg-indigo-600 text-white border-indigo-600" : "bg-card text-foreground border-border hover:border-indigo-300"}`}
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
              className="px-4 py-2 rounded-md text-sm font-medium border border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <Coins className="h-4 w-4 mr-1.5" /> Ver pagos parciales
            </button>
            <AlertDialogAction
              onClick={handleConfirmPayment}
              disabled={!paymentMethod.trim() || (hasActivePaymentCatalog && !activePaymentMethodNames.includes(paymentMethod.trim()))}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              Confirmar Pago Total
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert confirmation */}
      <AlertDialog open={!!convertQuotation} onOpenChange={(v) => { if (!v) { setConvertQuotation(null); setConvertPaymentMethod(""); setConvertError(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Convertir en venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se descontará el stock de los {convertQuotation?.items?.length || 0} producto(s) de la cotización {convertQuotation?.folio}. Total: ${convertQuotation?.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
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
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${convertPaymentMethod === pm.name ? "bg-indigo-600 text-white border-indigo-600" : "bg-card text-foreground border-border hover:border-indigo-300"}`}
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
            <AlertDialogAction onClick={handleConvertToSale} disabled={!convertPaymentMethod.trim() || (hasActivePaymentCatalog && !activePaymentMethodNames.includes(convertPaymentMethod.trim()))} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
              Confirmar Venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}