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
import { useBusinessContext } from "@/components/BusinessContext";
import { PackagePlus } from "lucide-react";

export default function CreateFromOnDemandModal({ open, onOpenChange, quotation, item, itemIndex, onSuccess }) {
  const { businessId } = useBusinessContext();
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
      // 1. Fetch current product stock
      const prods = await base44.entities.Product.filter({ id: item.product_id, business_id: businessId });
      if (prods.length === 0) {
        toast.error("Producto no encontrado en el catálogo");
        setSaving(false);
        return;
      }
      const product = prods[0];
      const currentStock = product.stock || 0;
      const newStock = currentStock + qty;

      // 2. Create entry movement.
      // El stock se actualiza a mano en el paso 3, por eso se marca
      // stock_applied=true: evita que applyMovementStock/automatización lo
      // sume otra vez (evita doble descuento/entrada).
      await base44.entities.Movement.create({
        product_id: item.product_id,
        product_name: item.product_name,
        type: "entry",
        quantity: qty,
        unit_price: item.unit_price,
        total: qty * item.unit_price,
        quotation_id: quotation.id,
        stock_after: newStock,
        reason: `Entrada por pedido - Cotización #${quotation.folio || quotation.id}${notes ? ` — ${notes}` : ""}`,
        business_id: businessId,
        stock_applied: true,
      });

      // 3. Update product stock
      await base44.entities.Product.update(item.product_id, { stock: newStock });

      // 4. Update quotation item status
      const updatedItems = (quotation.items || []).map((it, idx) => {
        if (idx === itemIndex) {
          return { ...it, on_demand_status: "product_created" };
        }
        return it;
      });
      await base44.entities.Quotation.update(quotation.id, { items: updatedItems });

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