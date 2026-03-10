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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, X, ScanBarcode, Wand2 } from "lucide-react";

const UNITS = ["pieza", "kg", "litro", "metro", "caja", "paquete"];

export default function ProductFormDialog({ open, onOpenChange, product, onSaved }) {
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    name: "", sku: "", barcode: "", description: "",
    category: "", supplier: "", purchase_price: 0,
    sale_price: 0, stock: 0, min_stock: 5, unit: "pieza",
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const lastKeystroke = React.useRef(Date.now());
  const barcodeBuffer = React.useRef("");

  useEffect(() => {
    Promise.all([
      base44.entities.Category.list(),
      base44.entities.Supplier.list(),
    ]).then(([cats, sups]) => {
      setCategories(cats);
      setSuppliers(sups);
    });
  }, []);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || "",
        sku: product.sku || "",
        barcode: product.barcode || "",
        description: product.description || "",
        category: product.category || "",
        supplier: product.supplier || "",
        purchase_price: product.purchase_price || 0,
        sale_price: product.sale_price || 0,
        stock: product.stock || 0,
        min_stock: product.min_stock || 5,
        unit: product.unit || "pieza",
        status: product.status || "active",
      });
    } else {
      setForm({
        name: "", sku: "", barcode: "", description: "",
        category: "", supplier: "", purchase_price: 0,
        sale_price: 0, stock: 0, min_stock: 5, unit: "pieza",
        status: "active",
      });
    }
  }, [product, open]);

  const handleSave = async () => {
    setSaving(true);
    if (product) {
      await base44.entities.Product.update(product.id, form);
    } else {
      await base44.entities.Product.create(form);
    }
    setSaving(false);
    onSaved();
    onOpenChange(false);
  };

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div className="md:col-span-2">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Nombre del producto" />
          </div>
          <div>
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => updateField("sku", e.target.value)} placeholder="Código SKU" />
          </div>
          <div>
            <Label>Código de barras</Label>
            <Input value={form.barcode} onChange={(e) => updateField("barcode", e.target.value)} placeholder="Escanee o ingrese" />
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={form.category} onValueChange={(v) => updateField("category", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Proveedor</Label>
            <Select value={form.supplier} onValueChange={(v) => updateField("supplier", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Precio de compra</Label>
            <Input type="number" min={0} step="0.01" value={form.purchase_price} onChange={(e) => updateField("purchase_price", parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Precio de venta *</Label>
            <Input type="number" min={0} step="0.01" value={form.sale_price} onChange={(e) => updateField("sale_price", parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Stock actual</Label>
            <Input type="number" min={0} value={form.stock} onChange={(e) => updateField("stock", parseInt(e.target.value) || 0)} disabled={!!product} />
          </div>
          <div>
            <Label>Stock mínimo</Label>
            <Input type="number" min={0} value={form.min_stock} onChange={(e) => updateField("min_stock", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Unidad</Label>
            <Select value={form.unit} onValueChange={(v) => updateField("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Descripción</Label>
            <Textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Descripción..." rows={3} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!form.name || !form.sale_price || saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}