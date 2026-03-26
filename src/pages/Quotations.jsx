import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Pencil, ShoppingCart, FileDown, Truck, CheckCircle2, DollarSign, XCircle, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { generateQuotationPDF } from "@/components/quotations/QuotationPDF";
import QuotationPreviewDialog from "@/components/quotations/QuotationPreviewDialog";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
import { createButtonProps } from "@/lib/a11y";
import VirtualizedQuotationTable from "@/components/tables/VirtualizedQuotationTable";

const statusConfig = {
  draft: { label: "Borrador", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400", desc: "Cotización en edición" },
  sent: { label: "Enviada", color: "bg-blue-100 text-blue-700", dot: "bg-blue-400", desc: "Enviada al cliente" },
  accepted: { label: "Aceptada", color: "bg-amber-100 text-amber-700", dot: "bg-amber-400", desc: "Aceptada por cliente" },
  converted: { label: "Concretada", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", desc: "Convertida en venta" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700", dot: "bg-red-500", desc: "Cancelada/Anulada" },
};

const isExpired = (q) => {
  if (!q.valid_until || q.status === "converted" || q.status === "cancelled") return false;
  return new Date(q.valid_until) < new Date(new Date().toDateString());
};

export default function Quotations() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [settings, setSettings] = useState(null);
  const [businessId, setBusinessId] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setBusinessId(u?.business_id || null);
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

    // FASE 1: Validar stock ANTES de cualquier operación (captura estado actual)
    // CRITICAL FIX: Add business_id filter for cross-tenant safety
    if (convertQuotation.business_id !== businessId) {
      setConvertError("No tienes permiso para convertir esta cotización");
      return;
    }
    const itemsWithStock = [];
    for (const item of (convertQuotation.items || [])) {
      const prods = await base44.entities.Product.filter({ id: item.product_id, business_id: businessId });
      const product = prods[0];
      if (!product) {
        setConvertError(`Producto "${item.product_name}" ya no existe. Edita la cotización.`);
        return;
      }
      if (item.quantity > (product.stock || 0)) {
        setConvertError(`Stock insuficiente para "${item.product_name}": disponible ${product.stock}, solicitado ${item.quantity}.`);
        return;
      }
      itemsWithStock.push({ ...item, product });
    }

    // FASE 2: Preparar todas las operaciones sin ejecutarlas aún
    const movementsToCreate = itemsWithStock.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      type: "exit",
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      stock_after: (item.product.stock || 0) - item.quantity,
      reference: `Venta ${convertQuotation.folio}`,
      reason: `Venta a ${convertQuotation.client_name}`,
      quotation_id: convertQuotation.id,
      business_id: convertQuotation.business_id,
    }));

    const productsToUpdate = itemsWithStock.map(item => ({
      id: item.product.id,
      newStock: (item.product.stock || 0) - item.quantity,
    }));

    // FASE 3: Ejecutar operaciones con manejo de errores. Si algo falla, todo se revierte
    try {
      // Crear movimientos
      const createdMovements = [];
      for (const mov of movementsToCreate) {
        createdMovements.push(await base44.entities.Movement.create(mov));
      }

      // Actualizar stock de productos
      for (const prod of productsToUpdate) {
        await base44.entities.Product.update(prod.id, { stock: prod.newStock });
      }

      // Marcar cotización como convertida
      await base44.entities.Quotation.update(convertQuotation.id, {
        status: "converted",
        payment_method: convertPaymentMethod,
      });

      setConvertQuotation(null);
      setConvertPaymentMethod("");
      setConvertError("");
      loadData();
    } catch (error) {
      // Si algo falló, mostrar error claro y no avanzar
      setConvertError(`Error durante conversión: ${error.message || "Intenta nuevamente"}. El stock no fue modificado.`);
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

    // FASE 1: Si la cotización fue convertida, buscar movimientos de salida originales para revertir correctamente
    if (cancelQuotation.status === "converted") {
      try {
        // Buscar movimientos de EXIT asociados a esta cotización (with business_id filter)
        const exitMovements = await base44.entities.Movement.filter({
          quotation_id: cancelQuotation.id,
          type: "exit",
          business_id: businessId,
        });

        // Para cada movimiento de salida, crear un movimiento de retorno inverso
         for (const exitMov of exitMovements) {
           // stock_after del exit es el stock resultante DESPUÉS de la salida
           // Para restaurar, simplemente sumamos la cantidad nuevamente
           // CRITICAL FIX: Add business_id filter
           const prods = await base44.entities.Product.filter({ id: exitMov.product_id, business_id: businessId });
           const product = prods[0];

          if (product) {
            // Restaurar stock: el stock actual del producto + cantidad que se retorna
            const restoredStock = (product.stock || 0) + exitMov.quantity;

            // Crear movimiento de retorno
            await base44.entities.Movement.create({
              product_id: exitMov.product_id,
              product_name: exitMov.product_name,
              type: "return",
              quantity: exitMov.quantity,
              unit_price: exitMov.unit_price,
              total: exitMov.total,
              stock_after: restoredStock,
              reference: `Cancelación ${cancelQuotation.folio}`,
              reason: `Cancelación: ${cancelReason}`,
              quotation_id: cancelQuotation.id,
              business_id: cancelQuotation.business_id,
            });

            // Actualizar stock del producto
            await base44.entities.Product.update(product.id, { stock: restoredStock });
          }
        }
      } catch (error) {
        toast.error(`Error al revertir stock: ${error.message}`);
        return;
      }
    }

    // FASE 2: Marcar cotización como cancelada
    try {
      await base44.entities.Quotation.update(cancelQuotation.id, {
        status: "cancelled",
        cancellation_reason: cancelReason,
      });
      setCancelQuotation(null);
      setCancelReason("");
      loadData();
    } catch (error) {
      toast.error(`Error al cancelar cotización: ${error.message}`);
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
    const update = { paid: true, payment_method: paymentMethod };
    if (payMarkDelivered) { update.delivered = true; update.in_route = false; }
    await base44.entities.Quotation.update(payQuotation.id, update);
    setPayQuotation(null);
    setPaymentMethod("");
    setPayMarkDelivered(false);
    loadData();
  };

  const handleEdit = (q) => {
    navigate(`/Quotations/edit/${q.id}`);
  };

  if (loading) {
    return <TableSkeleton rows={8} columns={8} />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate("/Quotations/new")}>
          <Plus className="h-4 w-4 mr-1" /> Nueva Cotización
        </Button>
      </div>

      <VirtualizedQuotationTable
        quotations={filtered}
        statusConfig={statusConfig}
        onEdit={handleEdit}
        onPreview={setPreviewQuotation}
        onDownloadPDF={(q) => generateQuotationPDF(q, settings)}
        onConvert={(q) => {
          setConvertQuotation(q);
          setConvertPaymentMethod(q.payment_method || "");
          setConvertError("");
        }}
        onCancel={(q) => {
          setCancelQuotation(q);
          setCancelReason("");
        }}
        onPay={(q) => {
          setPayQuotation(q);
          setPaymentMethod(q.payment_method || "");
        }}
        onInvoiceStatusChange={async (q, val) => {
          await base44.entities.Quotation.update(q.id, { invoice_status: val });
          loadData();
        }}
        onInRouteChange={async (q) => {
          await base44.entities.Quotation.update(q.id, { in_route: !q.in_route, delivered: false });
          loadData();
        }}
        onDeliveredChange={(q) => {
          if (!q.delivered) {
            setPayQuotation(q);
            setPaymentMethod(q.payment_method || "");
            setPayMarkDelivered(true);
          } else {
            base44.entities.Quotation.update(q.id, { delivered: false }).then(loadData);
          }
        }}
        isExpired={isExpired}
      />

      <QuotationPreviewDialog
        quotation={previewQuotation}
        settings={settings}
        open={!!previewQuotation}
        onOpenChange={(v) => !v && setPreviewQuotation(null)}
      />

      {/* Cancel dialog */}
      <AlertDialog open={!!cancelQuotation} onOpenChange={(v) => { if (!v) { setCancelQuotation(null); setCancelReason(""); } }}>
        <AlertDialogContent role="alertdialog" aria-labelledby="cancel-title">
          <AlertDialogHeader>
            <AlertDialogTitle id="cancel-title">
              {cancelQuotation?.status === "converted" ? `¿Anular venta ${cancelQuotation?.folio}?` : `¿Cancelar cotización ${cancelQuotation?.folio}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelQuotation?.status === "converted"
                ? "⚠️ Esta venta ya fue concretada. Al anularla se revertirá el stock de todos los productos. Esta acción no se puede deshacer."
                : "Esta acción marcará la cotización como cancelada. Por favor indica el motivo."}
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