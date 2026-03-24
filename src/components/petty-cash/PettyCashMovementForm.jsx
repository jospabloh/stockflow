import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import moment from "moment";

const EXPENSE_CATEGORIES = ["Papelería", "Limpieza", "Transporte", "Compras menores", "Mantenimiento menor", "Viáticos locales", "Otros"];
const INCOME_CATEGORIES = ["Reposición", "Reintegro", "Ajuste positivo", "Otros"];

const TYPE_CONFIG = {
  initial_fund: { label: "Fondo Inicial", categories: INCOME_CATEGORIES },
  income:       { label: "Ingreso",       categories: INCOME_CATEGORIES },
  expense:      { label: "Egreso",        categories: EXPENSE_CATEGORIES },
  adjustment:   { label: "Ajuste",        categories: [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] },
};

export default function PettyCashMovementForm({ open, movementType, businessId, currentBalance, onSaved, onClose }) {
  const config = TYPE_CONFIG[movementType] || TYPE_CONFIG.income;
  const [form, setForm] = useState({
    amount: "",
    description: "",
    category: "",
    movement_date: moment().format("YYYY-MM-DD"),
    reference: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const willBeNegative = movementType === "expense" && currentBalance - parseFloat(form.amount || 0) < 0;

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error("El monto debe ser mayor a cero"); return; }
    if (!form.description.trim()) { toast.error("Debes capturar una descripción"); return; }
    if (!form.movement_date) { toast.error("La fecha es obligatoria"); return; }
    if (!businessId) { toast.error("No se encontró el negocio asociado"); return; }

    setSaving(true);
    await base44.entities.PettyCashMovement.create({
      business_id: businessId,
      movement_type: movementType,
      amount,
      description: form.description.trim(),
      category: form.category || "",
      movement_date: form.movement_date,
      reference: form.reference.trim(),
      notes: form.notes.trim(),
    });
    toast.success("Movimiento guardado correctamente");
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{config.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {/* Amount */}
          <div>
            <Label>Monto *</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={e => set("amount", e.target.value)}
              className="text-lg font-semibold"
            />
            {willBeNegative && (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                ⚠️ Este egreso dejará el saldo en negativo (${(currentBalance - parseFloat(form.amount || 0)).toFixed(2)})
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <Label>Fecha del movimiento *</Label>
            <Input type="date" value={form.movement_date} onChange={e => set("movement_date", e.target.value)} />
          </div>

          {/* Description */}
          <div>
            <Label>Descripción *</Label>
            <Input placeholder="Descripción breve..." value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          {/* Category */}
          <div>
            <Label>Categoría</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.category}
              onChange={e => set("category", e.target.value)}
            >
              <option value="">Sin categoría</option>
              {config.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Reference */}
          <div>
            <Label>Referencia <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input placeholder="Folio, factura, comprobante..." value={form.reference} onChange={e => set("reference", e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <Label>Notas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Textarea rows={2} placeholder="Notas adicionales..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}