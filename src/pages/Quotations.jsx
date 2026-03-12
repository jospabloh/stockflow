import React, { useState, useEffect } from "react";
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
import QuotationFormDialog from "@/components/quotations/QuotationFormDialog";
import { generateQuotationPDF } from "@/components/quotations/QuotationPDF";
import QuotationPreviewDialog from "@/components/quotations/QuotationPreviewDialog";

const statusConfig = {
  draft: { label: "Borrador", color: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  sent: { label: "Enviada", color: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  accepted: { label: "Aceptada", color: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  converted: { label: "Concretada", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

const isExpired = (q) => {
  if (!q.valid_until || q.status === "converted" || q.status === "cancelled") return false;
  return new Date(q.valid_until) < new Date(new Date().toDateString());
};

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState(null);
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

  useEffect(() => {
    base44.entities.AppSettings.list().then(s => setSettings(s[0] || null)).catch(() => {});
  }, []);

  const loadData = () => {
    setLoading(true);
    base44.entities.Quotation.list("-created_date", 100).then((q) => {
      setQuotations(q);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const filtered = quotations.filter((q) => {
    const s = search.toLowerCase();
    return (
      q.client_name?.toLowerCase().includes(s) ||
      q.folio?.toLowerCase().includes(s) ||
      q.client_email?.toLowerCase().includes(s) ||
      q.client_phone?.toLowerCase().includes(s) ||
      statusConfig[q.status]?.label?.toLowerCase().includes(s)
    );
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

    // BUG-018: Validar stock suficiente antes de proceder
    for (const item of (convertQuotation.items || [])) {
      const prods = await base44.entities.Product.filter({ id: item.product_id });
      const product = prods[0];
      if (product && item.quantity > (product.stock || 0)) {
        setConvertError(`Stock insuficiente para "${item.product_name}": solo hay ${product.stock} unidad(es).`);
        return;
      }
    }

    // Create exit movements for each item — BUG-009: popular reason
    for (const item of (convertQuotation.items || [])) {
      const prods = await base44.entities.Product.filter({ id: item.product_id });
      const product = prods[0];
      if (product) {
        const newStock = (product.stock || 0) - item.quantity;
        await base44.entities.Movement.create({
          product_id: item.product_id,
          product_name: item.product_name,
          type: "exit",
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          stock_after: newStock,
          reference: `Venta ${convertQuotation.folio}`,
          reason: `Venta a ${convertQuotation.client_name}`,
          quotation_id: convertQuotation.id,
        });
        await base44.entities.Product.update(product.id, { stock: newStock });
      }
    }

    await base44.entities.Quotation.update(convertQuotation.id, {
      status: "converted",
      payment_method: convertPaymentMethod,
    });
    setConvertQuotation(null);
    setConvertPaymentMethod("");
    setConvertError("");
    loadData();
  };

  const handleCancel = async () => {
    if (!cancelQuotation) return;
    // BUG-020: Revertir stock si la cotización ya había sido convertida
    if (cancelQuotation.status === "converted") {
      for (const item of (cancelQuotation.items || [])) {
        const prods = await base44.entities.Product.filter({ id: item.product_id });
        const product = prods[0];
        if (product) {
          const restoredStock = (product.stock || 0) + item.quantity;
          await base44.entities.Movement.create({
            product_id: item.product_id,
            product_name: item.product_name,
            type: "return",
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            stock_after: restoredStock,
            reference: `Cancelación ${cancelQuotation.folio}`,
            reason: `Cancelación: ${cancelReason}`,
            quotation_id: cancelQuotation.id,
          });
          await base44.entities.Product.update(product.id, { stock: restoredStock });
        }
      }
    }
    await base44.entities.Quotation.update(cancelQuotation.id, {
      status: "cancelled",
      cancellation_reason: cancelReason,
    });
    setCancelQuotation(null);
    setCancelReason("");
    loadData();
  };

  const handleConfirmPayment = async () => {
    if (!payQuotation) return;
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
    setEditingQuotation(q);
    setFormOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
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
          />
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => { setEditingQuotation(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva Cotización
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="font-semibold text-slate-600">Folio</TableHead>
                <TableHead className="font-semibold text-slate-600">Cliente</TableHead>
                <TableHead className="font-semibold text-slate-600">Fecha</TableHead>
                <TableHead className="font-semibold text-slate-600 text-right">Total</TableHead>
                <TableHead className="font-semibold text-slate-600 text-center">Estado</TableHead>
                <TableHead className="font-semibold text-slate-600 text-center">Seguimiento</TableHead>
                <TableHead className="font-semibold text-slate-600 text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">Sin cotizaciones</TableCell>
                </TableRow>
              ) : (
                filtered.map((q) => {
                  const status = statusConfig[q.status] || statusConfig.draft;
                  return (
                    <TableRow key={q.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-mono text-sm text-indigo-600 cursor-pointer hover:underline" onClick={() => setPreviewQuotation(q)}>
                        <span className="flex items-center gap-1.5">
                          {q.folio}
                          {q.delivered && !q.paid && (
                            <span title="Entregado sin confirmar pago">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">{q.client_name}</TableCell>
                      <TableCell className="text-slate-600">{moment(q.created_date).format("DD/MM/YY")}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-700">
                        ${q.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col gap-1 items-center">
                          {isExpired(q) ? (
                            <Badge className="bg-red-100 text-red-700 border-0 flex items-center gap-1.5 w-fit">
                              <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                              Vencida
                            </Badge>
                          ) : (
                            <Badge className={`${status.color} border-0 flex items-center gap-1.5 w-fit`}>
                              <span className={`h-2 w-2 rounded-full ${status.dot} inline-block`} />
                              {status.label}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {q.status === "converted" && (
                          <div className="flex items-center justify-center gap-3">
                            <button
                              title={q.in_route ? "En ruta (click para desmarcar)" : "Marcar en ruta"}
                              onClick={async () => {
                                // Toggle in_route; if activating, clear delivered. If deactivating, just clear.
                                await base44.entities.Quotation.update(q.id, { in_route: !q.in_route, delivered: false });
                                loadData();
                              }}
                              className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${q.in_route ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-500"}`}
                            >
                              <Truck className="h-3.5 w-3.5" />
                              {q.in_route ? "En ruta" : "Ruta"}
                            </button>
                            <button
                              title={q.delivered ? "Entregado (click para desmarcar)" : "Marcar entregado"}
                              onClick={() => {
                                if (!q.delivered) {
                                  // BUG-010: Requerir método de pago antes de marcar entregado
                                  setPayQuotation(q);
                                  setPaymentMethod(q.payment_method || "");
                                  setPayMarkDelivered(true);
                                } else {
                                  base44.entities.Quotation.update(q.id, { delivered: false }).then(loadData);
                                }
                              }}
                              className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${q.delivered ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500"}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {q.delivered ? "Entregado" : "Entrega"}
                            </button>
                            <button
                              title={q.paid ? `Pagado: ${q.payment_method || "—"}` : "Confirmar pago"}
                              onClick={() => { if (!q.paid) { setPayQuotation(q); setPaymentMethod(q.payment_method || ""); } }}
                              className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${q.paid ? "bg-green-100 text-green-700 cursor-default" : "bg-slate-100 text-slate-400 hover:bg-green-50 hover:text-green-500"}`}
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                              {q.paid ? (q.payment_method || "Pagado") : "Pago"}
                            </button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {q.status !== "converted" && q.status !== "cancelled" && (
                              <DropdownMenuItem onClick={() => handleEdit(q)}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => generateQuotationPDF(q, settings)}>
                              <FileDown className="h-4 w-4 mr-2" /> Descargar PDF
                            </DropdownMenuItem>
                            {q.status !== "converted" && q.status !== "cancelled" && (
                              <DropdownMenuItem onClick={() => {
                                if (isExpired(q)) {
                                  alert(`Cotización vencida el ${new Date(q.valid_until).toLocaleDateString("es-MX")}. No se puede convertir.`);
                                  return;
                                }
                                setConvertQuotation(q);
                                setConvertPaymentMethod(q.payment_method || "");
                                setConvertError("");
                              }}>
                                <ShoppingCart className="h-4 w-4 mr-2" /> Convertir en Venta
                              </DropdownMenuItem>
                            )}
                            {q.status === "converted" && !q.paid && (
                              <DropdownMenuItem onClick={() => { setPayQuotation(q); setPaymentMethod(q.payment_method || ""); }}>
                                <DollarSign className="h-4 w-4 mr-2" /> Confirmar Pago
                              </DropdownMenuItem>
                            )}
                            {q.status !== "cancelled" && (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => { setCancelQuotation(q); setCancelReason(""); }}
                              >
                                <XCircle className="h-4 w-4 mr-2" /> {q.status === "converted" ? "Anular Venta" : "Cancelar Cotización"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <QuotationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        quotation={editingQuotation}
        onSaved={loadData}
      />

      <QuotationPreviewDialog
        quotation={previewQuotation}
        settings={settings}
        open={!!previewQuotation}
        onOpenChange={(v) => !v && setPreviewQuotation(null)}
      />

      {/* Cancel dialog */}
      <AlertDialog open={!!cancelQuotation} onOpenChange={(v) => { if (!v) { setCancelQuotation(null); setCancelReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
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