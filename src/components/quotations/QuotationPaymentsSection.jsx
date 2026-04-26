import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SelectWrapper from "@/components/wrappers/SelectWrapper";
import { toast } from "sonner";
import { DollarSign, Plus, CreditCard } from "lucide-react";
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
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toLocaleDateString("en-CA"));
  const [notes, setNotes] = useState("");
  const [registerPettyCash, setRegisterPettyCash] = useState(false);
  const [saving, setSaving] = useState(false);

  const canRegisterPayment = userRole === "admin" || userRole === "almacenista";

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
  const isCash = method.toLowerCase().includes("efectivo");

  const openModal = () => {
    setAmount(String(balance > 0 ? balance.toFixed(2) : ""));
    setMethod(quotation.payment_method || "");
    setPaidAt(new Date().toLocaleDateString("en-CA"));
    setNotes("");
    setRegisterPettyCash(false);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("El monto debe ser mayor a 0"); return; }
    if (amt > balance + 0.01) { toast.error(`El monto no puede superar el saldo pendiente ($${fmt(balance)})`); return; }
    if (!method) { toast.error("Selecciona una forma de pago"); return; }

    setSaving(true);
    try {
      const response = await base44.functions.invoke("registerQuotationPayment", {
        quotation_id: quotation.id,
        amount: amt,
        payment_method: method,
        paid_at: paidAt,
        notes,
        register_in_petty_cash: isCash && registerPettyCash,
      });

      const data = response.data;
      if (!data.success) throw new Error(data.error || "Error al registrar");

      const isFullyPaid = data.is_paid_full;
      let msg = `✅ Pago de $${fmt(amt)} registrado`;
      if (isCash && registerPettyCash) msg = "✅ Pago registrado e ingresado a caja chica";
      toast.success(msg);
      if (isFullyPaid) toast.success("🎉 Cotización pagada en su totalidad");

      setModalOpen(false);
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
          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">${fmt(total)}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
          <p className="text-[10px] font-bold uppercase text-emerald-500 mb-1">Pagado</p>
          <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">${fmt(amountPaid)}</p>
        </div>
        <div className={`rounded-lg p-3 text-center ${balance > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}>
          <p className={`text-[10px] font-bold uppercase mb-1 ${balance > 0 ? "text-red-400" : "text-emerald-500"}`}>Saldo</p>
          <p className={`font-bold text-sm ${balance > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
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
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id || i} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString("es-MX") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    ${fmt(p.amount)}
                  </td>
                  <td className="px-3 py-2 text-foreground">{p.payment_method}</td>
                  <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{p.notes || "—"}</td>
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
          onClick={openModal}
          className="bg-green-600 hover:bg-green-700 text-white w-full"
        >
          <Plus className="h-4 w-4 mr-1" /> Registrar Pago
        </Button>
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
              Registrar Pago — {quotation.folio}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground">
              Saldo pendiente: <strong className="text-red-600">${fmt(balance)}</strong>
            </div>

            <div>
              <Label className="mb-1 block">Monto <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={0.01}
                max={balance}
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={fmt(balance)}
              />
            </div>

            <div>
              <Label className="mb-1 block">Forma de pago <span className="text-red-500">*</span></Label>
              <SelectWrapper
                value={method}
                onValueChange={setMethod}
                placeholder="Seleccionar método"
                options={paymentMethods.map(m => ({ value: m.name, label: m.name }))}
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
              <label className="flex items-center gap-3 cursor-pointer bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={registerPettyCash}
                  onChange={e => setRegisterPettyCash(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-amber-800 dark:text-amber-300">
                  ¿Integrar este ingreso a caja chica?
                </span>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !amount || !method}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? "Guardando..." : "Guardar pago"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}