import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SelectWrapper from "@/components/wrappers/SelectWrapper";
import { toast } from "sonner";
import { useBusinessContext } from "@/components/BusinessContext";
import { Package } from "lucide-react";

export default function CreateFromOnDemandModal({ open, onOpenChange, quotation, item, itemIndex, onSuccess }) {
  const { businessId } = useBusinessContext();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ category: "", retail_sale_price: "", wholesale_sale_price: "", purchase_price: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && businessId) {
      base44.entities.Category.filter({ business_id: businessId }).then(setCategories).catch(() => {});
      setForm({ category: "", retail_sale_price: "", wholesale_sale_price: "", purchase_price: "" });
    }
  }, [open, businessId]);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleCreate = async () => {
    if (!form.category) { toast.error("Selecciona una categoría"); return; }
    if (!form.retail_sale_price || Number(form.retail_sale_price) <= 0) { toast.error("El precio de menudeo es requerido"); return; }
    if (!form.wholesale_sale_price || Number(form.wholesale_sale_price) <= 0) { toast.error("El precio de mayoreo es requerido"); return; }

    setSaving(true);
    try {
      // 1. Crear el producto
      const newProduct = await base44.entities.Product.create({
        name: item.product_name,
        description: item.product_description || "",
        supplier: item.supplier_id || null,
        category: form.category,
        retail_sale_price: Number(form.retail_sale_price),
        wholesale_sale_price: Number(form.wholesale_sale_price),
        purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
        stock: 0,
        business_id: businessId,
        status: "active",
      });

      // 2. Crear movimiento de entrada
      await base44.entities.Movement.create({
        product_id: newProduct.id,
        product_name: item.product_name,
        type: "entry",
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: form.purchase_price ? Number(form.purchase_price) : 0,
        total: item.total,
        quotation_id: quotation.id,
        stock_after: item.quantity,
        business_id: businessId,
        reason: `Ingreso desde producto bajo pedido - Cotización #${quotation.folio || quotation.id}`,
      });

      // 3. Actualizar stock del producto
      await base44.entities.Product.update(newProduct.id, { stock: item.quantity });

      // 4. Actualizar item dentro de quotation.items
      const updatedItems = (quotation.items || []).map((it, idx) => {
        if (idx === itemIndex) {
          return { ...it, product_id: newProduct.id, on_demand_status: "product_created" };
        }
        return it;
      });
      await base44.entities.Quotation.update(quotation.id, { items: updatedItems });

      toast.success("✅ Producto creado e ingresado al catálogo");
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-500" />
            Crear producto: {item.product_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {item.product_description && (
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
              <strong>Descripción:</strong> {item.product_description}
            </div>
          )}
          {item.supplier_name && (
            <div className="text-sm text-muted-foreground">
              <strong>Proveedor:</strong> {item.supplier_name}
            </div>
          )}

          <div>
            <Label className="mb-1 block">Categoría <span className="text-red-500">*</span></Label>
            <SelectWrapper
              value={form.category}
              onValueChange={v => set("category", v)}
              placeholder="Seleccionar categoría"
              options={categories.map(c => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Precio menudeo <span className="text-red-500">*</span></Label>
              <Input type="number" min={0} step="0.01" value={form.retail_sale_price}
                onChange={e => set("retail_sale_price", e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="mb-1 block">Precio mayoreo <span className="text-red-500">*</span></Label>
              <Input type="number" min={0} step="0.01" value={form.wholesale_sale_price}
                onChange={e => set("wholesale_sale_price", e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div>
            <Label className="mb-1 block">Precio de compra / costo</Label>
            <Input type="number" min={0} step="0.01" value={form.purchase_price}
              onChange={e => set("purchase_price", e.target.value)} placeholder="0.00 (opcional)" />
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
            Se creará el producto con <strong>stock 0</strong> y se registrará una entrada de <strong>{item.quantity} {item.unit || "uds"}</strong> vinculada a la cotización <strong>#{quotation?.folio}</strong>.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
            {saving ? "Creando..." : "Crear y vincular"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}