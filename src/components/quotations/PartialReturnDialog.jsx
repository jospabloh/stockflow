import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

export default function PartialReturnDialog({ open, onOpenChange, quotation, onSaved }) {
  const [returnItems, setReturnItems] = useState({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setReturnItems({});
      setReason("");
    }
  }, [open]);

  const toggleItem = (item) => {
    setReturnItems(prev => {
      if (prev[item.product_id]) {
        const next = { ...prev };
        delete next[item.product_id];
        return next;
      }
      return { ...prev, [item.product_id]: { ...item, returnQty: 1 } };
    });
  };

  const setReturnQty = (product_id, qty, max) => {
    const clamped = Math.max(1, Math.min(qty, max));
    setReturnItems(prev => ({
      ...prev,
      [product_id]: { ...prev[product_id], returnQty: clamped }
    }));
  };

  const handleSubmit = async () => {
    const selectedItems = Object.values(returnItems);
    if (selectedItems.length === 0) {
      toast.error("Selecciona al menos un producto a devolver");
      return;
    }
    if (!reason.trim()) {
      toast.error("Escribe el motivo de la devolución");
      return;
    }

    setSaving(true);
    try {
      const returned_items = selectedItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.returnQty,
        unit_price: i.unit_price,
        tax_rate: i.tax_rate ?? 16,
      }));

      const res = await base44.functions.invoke('partialReturnQuotation', {
        quotation_id: quotation.id,
        returned_items,
        reason,
      });

      if (!res.data.success) {
        toast.error(`Error: ${res.data.error}`);
        return;
      }

      toast.success(`✅ Devolución registrada — ${returned_items.length} producto(s) devuelto(s)`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Error inesperado: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const returnTotal = Object.values(returnItems).reduce((sum, i) => sum + (i.returnQty * i.unit_price), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-500" />
            Devolución Parcial — {quotation?.folio}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Selecciona los productos que el cliente devolvió. El stock se restaurará automáticamente.</p>

          <div className="space-y-2">
            {(quotation?.items || []).map((item) => {
              const selected = !!returnItems[item.product_id];
              return (
                <div
                  key={item.product_id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selected ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : "border-border bg-card"}`}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggleItem(item)}
                    id={`item-${item.product_id}`}
                  />
                  <label htmlFor={`item-${item.product_id}`} className="flex-1 cursor-pointer">
                    <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Vendido: {item.quantity} u · ${item.unit_price?.toLocaleString("es-MX", { minimumFractionDigits: 2 })} c/u
                    </p>
                  </label>
                  {selected && item.quantity > 1 && (
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Cant:</Label>
                      <Input
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={returnItems[item.product_id]?.returnQty || 1}
                        onChange={(e) => setReturnQty(item.product_id, parseInt(e.target.value) || 1, item.quantity)}
                        className="w-16 h-7 text-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {Object.keys(returnItems).length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-xl px-4 py-2 text-sm flex justify-between">
              <span className="text-orange-700 dark:text-orange-400 font-medium">Monto a descontar de la venta</span>
              <span className="font-bold text-orange-700 dark:text-orange-400">
                −${returnTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div>
            <Label className="mb-1.5 block">Motivo de devolución *</Label>
            <Textarea
              placeholder="Ej: El cliente devolvió el producto porque vino dañado..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={Object.keys(returnItems).length === 0 || !reason.trim() || saving}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            {saving ? "Procesando..." : "Registrar Devolución"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}