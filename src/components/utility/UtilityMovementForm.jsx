import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MobileSelect } from "@/components/ui/MobileSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { celebrate } from "@/lib/celebrate";
import moment from "moment";

const TYPE_LABELS = { income: "Ingreso", expense: "Retiro de utilidad" };

export default function UtilityMovementForm({ open, movementType, businessId, rubros, accounts, movement, onSaved, onClose }) {
  const isEdit = !!movement;
  const effectiveType = isEdit ? movement.movement_type : movementType;
  const [form, setForm] = useState(
    isEdit
      ? {
          amount: String(movement.amount || ""),
          movement_date: movement.movement_date || moment().format("YYYY-MM-DD"),
          rubro_id: movement.rubro_id || "",
          account_id: movement.account_id || "",
          description: movement.description || "",
          reference: movement.reference || "",
          notes: movement.notes || "",
        }
      : {
          amount: "",
          movement_date: moment().format("YYYY-MM-DD"),
          rubro_id: "",
          account_id: "",
          description: "",
          reference: "",
          notes: "",
        }
  );
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const rubroOptions = (rubros || [])
    .filter((r) => r.kind === effectiveType)
    .map((r) => ({ value: r.id, label: r.name }));
  const accountOptions = (accounts || []).map((a) => ({ value: a.id, label: a.name }));

  const selectedAccount = (accounts || []).find((a) => a.id === form.account_id);
  const accountAffectsPettyCash = !!selectedAccount?.affects_petty_cash;

  const buildPettyCashPayload = (amount, rubroName, accountName) => ({
    business_id: businessId,
    movement_type: effectiveType, // income | expense — el saldo de Caja Chica ya lo maneja
    amount,
    description: form.description.trim() || `${TYPE_LABELS[effectiveType]}: ${rubroName || "Utilidad"}`,
    category: rubroName || "",
    movement_date: form.movement_date,
    reference: form.reference.trim(),
    notes: form.notes.trim(),
    generated_by_system: true,
    origin_type: "utility",
    payment_method_snapshot: accountName || "",
  });

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error("El monto debe ser mayor a cero"); return; }
    if (!form.rubro_id) { toast.error("Selecciona un rubro"); return; }
    if (!form.account_id) { toast.error("Selecciona una cuenta"); return; }
    if (!form.movement_date) { toast.error("La fecha es obligatoria"); return; }
    if (!businessId) { toast.error("No se encontró el negocio asociado"); return; }

    const rubro = (rubros || []).find((r) => r.id === form.rubro_id);
    const account = (accounts || []).find((a) => a.id === form.account_id);
    const affects = !!account?.affects_petty_cash;

    setSaving(true);
    try {
      let registeredBy = movement?.registered_by || "";
      if (!isEdit) {
        registeredBy = (await base44.auth.me().catch(() => null))?.email || "";
      }

      const basePayload = {
        business_id: businessId,
        movement_type: effectiveType,
        amount,
        movement_date: form.movement_date,
        rubro_id: form.rubro_id,
        rubro_name: rubro?.name || "",
        rubro_kind: rubro?.kind || effectiveType,
        account_id: form.account_id,
        account_name: account?.name || "",
        affects_petty_cash: affects,
        description: form.description.trim(),
        reference: form.reference.trim(),
        notes: form.notes.trim(),
        registered_by: registeredBy,
      };

      if (isEdit) {
        const prevAffects = !!movement.affects_petty_cash;
        const existingPcId = movement.petty_cash_movement_id;
        let pettyCashId = existingPcId || "";

        if (affects && existingPcId) {
          await base44.entities.PettyCashMovement.update(existingPcId, {
            ...buildPettyCashPayload(amount, rubro?.name, account?.name),
            origin_id: movement.id,
          }).catch((err) => console.warn("No se pudo actualizar caja chica", err));
        } else if (affects && !existingPcId) {
          const pc = await base44.entities.PettyCashMovement.create({
            ...buildPettyCashPayload(amount, rubro?.name, account?.name),
            origin_id: movement.id,
          });
          pettyCashId = pc?.id || "";
        } else if (!affects && prevAffects && existingPcId) {
          await base44.entities.PettyCashMovement.delete(existingPcId).catch((err) => console.warn("No se pudo eliminar caja chica", err));
          pettyCashId = "";
        }

        await base44.entities.UtilityMovement.update(movement.id, {
          ...basePayload,
          petty_cash_movement_id: pettyCashId,
        });
        toast.success("Movimiento actualizado");
      } else {
        const created = await base44.entities.UtilityMovement.create({
          ...basePayload,
          petty_cash_movement_id: "",
        });
        if (affects) {
          const pc = await base44.entities.PettyCashMovement.create({
            ...buildPettyCashPayload(amount, rubro?.name, account?.name),
            origin_id: created.id,
          });
          await base44.entities.UtilityMovement.update(created.id, { petty_cash_movement_id: pc?.id || "" });
        }
        toast.success("Movimiento guardado correctamente");
        celebrate();
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Save utility movement error:", err);
      toast.error(`Error al guardar: ${err.message || "Intenta de nuevo"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar ${TYPE_LABELS[effectiveType]}` : TYPE_LABELS[effectiveType]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <Label>Monto *</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="text-lg font-semibold"
            />
          </div>

          <div>
            <Label>Fecha del movimiento *</Label>
            <Input type="date" value={form.movement_date} onChange={(e) => set("movement_date", e.target.value)} />
          </div>

          <div>
            <Label>Rubro *</Label>
            <MobileSelect
              value={form.rubro_id}
              onValueChange={(v) => set("rubro_id", v)}
              placeholder={rubroOptions.length === 0 ? "Sin rubros — créalos en Catálogos → Rubros" : "Selecciona un rubro"}
              options={rubroOptions}
            />
          </div>

          <div>
            <Label>Cuenta *</Label>
            <MobileSelect
              value={form.account_id}
              onValueChange={(v) => set("account_id", v)}
              placeholder={accountOptions.length === 0 ? "Sin cuentas — créalas en Catálogos → Cuentas" : "¿De dónde salió/entró el dinero?"}
              options={accountOptions}
            />
            {accountAffectsPettyCash && (
              <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                <PiggyBank className="h-3 w-3" />
                {effectiveType === "expense" ? "Se descontará de Caja Chica" : "Ingresará a Caja Chica"}
              </p>
            )}
          </div>

          <div>
            <Label>Descripción</Label>
            <Input placeholder="Descripción breve..." value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div>
            <Label>Referencia <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input placeholder="Folio, factura, comprobante..." value={form.reference} onChange={(e) => set("reference", e.target.value)} />
          </div>

          <div>
            <Label>Notas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Textarea rows={2} placeholder="Notas adicionales..." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
