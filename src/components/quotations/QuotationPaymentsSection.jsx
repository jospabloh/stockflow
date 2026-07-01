import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, CreditCard, Pencil, Trash2 } from "lucide-react";
import { useBusinessContext } from "@/components/BusinessContext";

function fmt(n) {
  return (n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Compat helpers for old quotations without the new fields
function getAmountPaid(q) {
  if (q.amount_paid != null) return q.amount_paid;
  return q.paid ? (q.total || 0) : 0;
}

function getBalance(q) {
  if (q.balance != null) return q.balance;
  if (q.paid) return 0;
  return (q.total || 0) - getAmountPaid(q);
}

export default function QuotationPaymentsSection({ quotation, onPaymentRegistered, userRole }) {
  const { businessId } = useBusinessContext();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null); // null = new, object = editing
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toLocaleDateString("en-CA"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const canRegisterPayment = !userRole || userRole === "admin" || userRole === "almacenista";

  useEffect(() => {
    if (businessId) {
      base44.entities.PaymentMethod.filter({ business_id: businessId, active: true })
        .then(setPaymentMethods)
        .catch(() => {});
    }
  }, [businessId]);

  if (!quotation) return null;

  const payments = Array.isArray(quotation.payments) ? quotation.payments : [];
  const amountPaid = getAmountPaid(quotation);
  const balance = getBalance(quotation);
  const total = quotation.total || 0;
  const isCash = method.toLowerCase().includes("efectivo"); // kept for info display

  const openNew = () => {
    setEditingPayment(null);
    setAmount(String(balance > 0 ? balance.toFixed(2) : ""));
    setMethod(quotation.payment_method || "");
    setPaidAt(new Date().toLocaleDateString("en-CA"));
    setNotes("");
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditingPayment(p);
    setAmount(String(p.amount || ""));
    setMethod(p.payment_method || "");
    setPaidAt(p.paid_at ? p.paid_at.split("T")[0] : new Date().toLocaleDateString("en-CA"));
    setNotes(p.notes || "");
    setModalOpen(true);
  };

  const handleDelete = async (p) => {
    if (!globalThis.confirm(`¿Eliminar el pago de $${fmt(p.amount)} (${p.payment_method})?`)) return;
    setDeletingId(p.id);
    try {
      const res = await base44.functions.invoke('quotationPayments', { action: 'deleteQuotationPayment',
        quotation_id: quotation.id,
        payment_id: p.id,
      });
      if (!res.data.success) throw new Error(res.data.error || "Error al eliminar");
      toast.success("Pago eliminado");
      onPaymentRegistered?.();
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("El monto debe ser mayor a 0"); return; }
    if (!method) { toast.error("Selecciona una forma de pago"); return; }

    if (!editingPayment && amt > balance + 0.01) {
      toast.error(`El monto no puede superar el saldo pendiente ($${fmt(balance)})`);
      return;
    }

    setSaving(true);
    try {
      let data;
      if (editingPayment) {
        const response = await base44.functions.invoke('quotationPayments', { action: 'editQuotationPayment',
          quotation_id: quotation.id,
          payment_id: editingPayment.id,
          amount: amt,
          payment_method: method,
          paid_at: paidAt,
          notes,
        });
        data = response.data;
      } else {
        const response = await base44.functions.invoke('quotationPayments', { action: 'registerQuotationPayment',
          quotation_id: quotation.id,
          amount: amt,
          payment_method: method,
          paid_at: paidAt,
          notes,
        });
        data = response.data;
      }

      if (!data.success) throw new Error(data.error || "Error al guardar");

      const msg = isCash
        ? `✅ Pago de $${fmt(amt)} ${editingPayment ? "actualizado" : "registrado"} e integrado a caja chica`
        : `✅ Pago de $${fmt(amt)} ${editingPayment ? "actualizado" : "registrado"}`;
      toast.success(msg);
      if (data.is_paid_full) toast.success("🎉 Cotización pagada en su totalidad");

      setModalOpen(false);
      setEditingPayment(null);
      onPaymentRegistered?.();
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Financial summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Total</p>
          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm font-mono tabular">${fmt(total)}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
          <p className="text-[10px] font-bold uppercase text-emerald-500 mb-1">Pagado</p>
          <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm font-mono tabular">${fmt(amountPaid)}</p>
        </div>
        <div className={`rounded-lg p-3 text-center ${balance > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}>
          <p className={`text-[10px] font-bold uppercase mb-1 ${balance > 0 ? "text-red-400" : "text-emerald-500"}`}>Saldo</p>
          <p className={`font-bold text-sm font-mono tabular ${balance > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            ${fmt(balance)}
          </p>
        </div>
      </div>

      {/* Payments history */}
      {payments.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2 text-left">Forma de pago</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Notas</th>
                {canRegisterPayment && <th className="px-3 py-2 w-16"></th>}
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id || i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString("es-MX") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400 tabular">
                    ${fmt(p.amount)}
                  </td>
                  <td className="px-3 py-2 text-foreground">{p.payment_method}</td>
                  <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{p.notes || "—"}</td>
                  {canRegisterPayment && (
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button type="button"
                          onClick={() => openEdit(p)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-brand-600 transition-colors"
                          title="Editar pago"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button"
                          onClick={() => handleDelete(p)}
                          disabled={deletingId === p.id}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
                          title="Eliminar pago"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">
          Sin pagos registrados
        </p>
      )}

      {/* Register payment button */}
      {balance > 0.01 && canRegisterPayment && (
        <Button
          size="sm"
          onClick={openNew}
          className="bg-green-600 hover:bg-green-700 text-white w-full text-sm font-semibold py-5"
        >
          <Plus className="h-4 w-4 mr-1" /> Registrar Pago{balance < total ? " Parcial" : ""}
        </Button>
      )}
      {balance > 0.01 && canRegisterPayment && payments.length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center">
          💡 Puedes registrar pagos parciales con diferentes métodos de pago
        </p>
      )}
      {quotation.paid && balance <= 0.01 && (
        <div className="text-center text-xs text-emerald-700 dark:text-emerald-400 font-semibold py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          ✅ Cotización pagada en su totalidad
        </div>
      )}

      {/* Payment modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              {editingPayment ? "Editar Pago" : "Registrar Pago"} — {quotation.folio}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted rounded-lg px-2 py-2">
                <p className="text-[10px] text-muted-foreground">Total</p>
                <p className="font-bold text-xs font-mono tabular">${fmt(total)}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-2 py-2">
                <p className="text-[10px] text-emerald-600">Pagado</p>
                <p className="font-bold text-xs text-emerald-700 font-mono tabular">${fmt(amountPaid)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-2 py-2">
                <p className="text-[10px] text-red-500">Saldo</p>
                <p className="font-bold text-xs text-red-700 font-mono tabular">${fmt(balance)}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-2 py-1.5">
              💡 Puedes ingresar un monto menor al saldo para registrar un <strong>pago parcial</strong>. Puedes usar diferentes métodos de pago.
            </p>

            <div>
              <Label className="mb-1 block">Monto <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={0.01}
                max={balance}
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={`Ej: ${fmt(balance / 2)} (parcial) o ${fmt(balance)} (total)`}
              />
            </div>

            <div>
              <Label className="mb-2 block">Forma de pago <span className="text-red-500">*</span></Label>
              {/* Siempre mostrar botones rápidos + los métodos del negocio */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                {(paymentMethods.length > 0
                  ? paymentMethods.map(m => m.name)
                  : ["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta crédito"]
                ).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      method === m
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-card text-foreground border-border hover:border-brand-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Otro método..."
                value={["Efectivo","Transferencia","Tarjeta débito","Tarjeta crédito"].includes(method) || paymentMethods.map(m=>m.name).includes(method) ? "" : method}
                onChange={e => setMethod(e.target.value)}
                className="text-sm"
              />
            </div>

            <div>
              <Label className="mb-1 block">Fecha del pago <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={paidAt}
                onChange={e => setPaidAt(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1 block">Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones del pago..."
                rows={2}
              />
            </div>

            {isCash && (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                <span className="text-sm text-emerald-700 dark:text-emerald-300">
                  💵 Este pago en efectivo se registrará automáticamente en caja chica.
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !amount || !method}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? "Guardando..." : editingPayment ? "Actualizar pago" : "Guardar pago"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}