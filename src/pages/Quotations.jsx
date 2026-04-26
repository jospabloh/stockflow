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


import { Plus, Search, Banknote } from "lucide-react";
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

  useEffect(() => {
    base44.auth.me().then(u => {
      setBusinessId(u?.business_id || null);
      setUserRole(u?.role || null);
      base44.entities.AppSettings.filter({ business_id: u?.business_id }).then(s => setSettings(s[0] || null)).catch(() => {});
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
    const matchSearch = q.client_name?.toLowerCase().includes(s) ||
      q.folio?.toLowerCase().includes(s) ||
      q.client_email?.toLowerCase().includes(s) ||
      q.client_phone?.toLowerCase().includes(s) ||
      statusConfig[q.status]?.label?.toLowerCase().includes(s);
    
    let matchStatus = statusFilter === "all";
    if (statusFilter === "converted") {
      matchStatus = q.status === "converted";
    } else if (statusFilter === "active") {
      matchStatus = ["draft", "sent", "accepted"].includes(q.status);
    } else if (statusFilter === "cancelled") {
      matchStatus = q.status === "cancelled";
    }
    
    return matchSearch && matchStatus;
  });

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
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por cliente o folio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Buscar cotizaciones por cliente o folio"
          />
        </div>
        {can('Cotizaciones', 'create') && (
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate("/Quotations/new")}>
            <Plus className="h-4 w-4 mr-1" /> Nueva Cotización
          </Button>
        )}
      </div>

      {can('Cotizaciones', 'view') && (
      <VirtualizedQuotationTable
        quotations={filtered}
        statusConfig={statusConfig}
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
            // Reload to pick up payment changes
            loadData(businessId);
            setPreviewQuotation(null);
            setPreviewClient(null);
          }
        }}
        onOnDemandCreated={() => loadData(businessId)}
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
            <AlertDialogTitle>{payMarkDelivered ? "Registrar entrega y pago" : "Confirmar pago"} — {payQuotation?.folio}</AlertDialogTitle>
            <AlertDialogDescription>
              Total: ${payQuotation?.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })} · Cliente: {payQuotation?.client_name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-3 space-y-2">
            <p className="text-sm font-medium text-slate-700">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta crédito", "Cheque", "Otro"].map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === m ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <Input
              placeholder="Otro método de pago..."
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPayment}
              disabled={!paymentMethod.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              Confirmar Pago
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
          <div className="px-1 py-3 space-y-2">
            <p className="text-sm font-medium text-slate-700">Método de pago <span className="text-red-500">*</span></p>
            <div className="grid grid-cols-2 gap-2">
              {["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta crédito", "Cheque", "Otro"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setConvertPaymentMethod(m); setConvertError(""); }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${convertPaymentMethod === m ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <Input
              placeholder="Otro método..."
              value={convertPaymentMethod}
              onChange={(e) => { setConvertPaymentMethod(e.target.value); setConvertError(""); }}
              className="mt-1"
            />
            {convertError && <p className="text-sm text-red-600">{convertError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertToSale} disabled={!convertPaymentMethod.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
              Confirmar Venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}