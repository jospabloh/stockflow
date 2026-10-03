import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";

export default function CreateFromOnDemandModal({ open, onOpenChange, quotation, item, itemIndex, onSuccess }) {
  const [quantityReceived, setQuantityReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && item) {
      setQuantityReceived(String(item.quantity));
      setNotes("");
    }
  }, [open, item]);

  const handleRegister = async () => {
    const qty = Number(quantityReceived);
    if (!qty || qty <= 0) {
      toast.error("La cantidad recibida debe ser mayor a 0");
      return;
    }

    setSaving(true);
    try {
      const resp = await base44.functions.invoke('quotations', {
        action: 'registerOnDemandArrivalSafe',
        quotation_id: quotation.id,
        item_index: itemIndex,
        quantity_received: qty,
        notes,
      });
      if (!resp?.data?.success) {
        toast.error(resp?.data?.error || "No se pudo registrar la entrada");
        setSaving(false);
        return;
      }

      if (resp?.data?.stock_warning) toast.warning(resp.data.stock_warning.message, { duration: 20000 });
      toast.success("✅ Entrada registrada. Stock actualizado.");
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-orange-500" />
            Registrar llegada de "{item.product_name}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Read-only summary */}
          <div className="bg-muted rounded-lg px-3 py-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Producto</span>
              <span className="font-medium text-foreground">{item.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cantidad cotizada</span>
              <span className="font-medium text-foreground tabular">{item.quantity} {item.unit || "pzs"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cotización</span>
              <span className="font-medium text-foreground">#{quotation?.folio}</span>
            </div>
          </div>

          <div>
            <Label className="mb-1 block">Cantidad recibida <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={quantityReceived}
              onChange={e => setQuantityReceived(e.target.value)}
              placeholder={String(item.quantity)}
            />
          </div>

          <div>
            <Label className="mb-1 block">Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observaciones sobre la llegada del pedido..."
              rows={2}
            />
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
            Se registrará una entrada de <strong>{quantityReceived || item.quantity} {item.unit || "pzs"}</strong> al producto "<strong>{item.product_name}</strong>" y se actualizará el stock del catálogo.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleRegister} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
            {saving ? "Registrando..." : "✅ Registrar entrada"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}