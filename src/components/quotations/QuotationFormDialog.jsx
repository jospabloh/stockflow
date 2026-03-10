import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function QuotationFormDialog({ open, onOpenChange, quotation, onSaved }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    items: [],
    notes: "",
    valid_until: "",
    status: "draft",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      base44.entities.Product.filter({ status: "active" }).then(setProducts);
      if (quotation) {
        setForm({
          client_name: quotation.client_name || "",
          client_email: quotation.client_email || "",
          client_phone: quotation.client_phone || "",
          items: quotation.items || [],
          notes: quotation.notes || "",
          valid_until: quotation.valid_until || "",
          status: quotation.status || "draft",
        });
      } else {
        setForm({
          client_name: "", client_email: "", client_phone: "",
          items: [], notes: "", valid_until: "", status: "draft",
        });
      }
    }
  }, [open, quotation]);

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: "", product_name: "", quantity: 1, unit_price: 0, total: 0 }],
    }));
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === "product_id") {
        const product = products.find((p) => p.id === value);
        if (product) {
          items[index].product_name = product.name;
          items[index].unit_price = product.sale_price;
          items[index].total = items[index].quantity * product.sale_price;
        }
      }
      if (field === "quantity" || field === "unit_price") {
        items[index].total = (items[index].quantity || 0) * (items[index].unit_price || 0);
      }
      return { ...prev, items };
    });
  };

  const subtotal = form.items.reduce((sum, item) => sum + (item.total || 0), 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;

  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...form,
      subtotal,
      tax,
      total,
      folio: quotation?.folio || `COT-${Date.now().toString(36).toUpperCase()}`,
    };
    if (quotation) {
      await base44.entities.Quotation.update(quotation.id, data);
    } else {
      await base44.entities.Quotation.create(data);
    }
    setSaving(false);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quotation ? "Editar Cotización" : "Nueva Cotización"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Cliente *</Label>
              <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Nombre" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="correo@email.com" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} placeholder="Teléfono" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base">Productos</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Agregar
              </Button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded-xl p-3">
                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-xs">Producto</Label>
                    <Select value={item.product_id} onValueChange={(v) => updateItem(idx, "product_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-xs">Cantidad</Label>
                    <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-xs">Precio</Label>
                    <Input type="number" min={0} step="0.01" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-3 md:col-span-3">
                    <Label className="text-xs">Total</Label>
                    <p className="h-10 flex items-center font-semibold text-slate-700">${item.total?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
              {form.items.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Agrega productos a la cotización</p>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium">${subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">IVA (16%)</span><span className="font-medium">${tax.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between text-lg border-t pt-2"><span className="font-semibold">Total</span><span className="font-bold text-indigo-700">${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Vigencia</Label>
              <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Condiciones..." rows={2} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.client_name || form.items.length === 0 || saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}