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
import { Save, ScanLine } from "lucide-react";

const TYPES = [
  { value: "entry", label: "Entrada (Compra)" },
  { value: "exit", label: "Salida (Venta)" },
  { value: "return", label: "Devolución" },
  { value: "adjustment", label: "Ajuste" },
];

export default function MovementFormDialog({ open, onOpenChange, onSaved }) {
  const barcodeRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    type: "entry",
    quantity: 1,
    unit_price: 0,
    reason: "",
    reference: "",
  });
  const [barcodeInput, setBarcodeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (open) {
      base44.entities.Product.filter({ status: "active" }).then(setProducts);
      setForm({ product_id: "", type: "entry", quantity: 1, unit_price: 0, reason: "", reference: "" });
      setSelectedProduct(null);
      setBarcodeInput("");
    }
  }, [open]);

  const handleBarcodeSearch = () => {
    const found = products.find(
      (p) => p.barcode === barcodeInput || p.sku === barcodeInput
    );
    if (found) {
      setSelectedProduct(found);
      setForm((prev) => ({
        ...prev,
        product_id: found.id,
        unit_price: prev.type === "exit" ? found.sale_price : found.purchase_price,
      }));
    }
  };

  const handleProductSelect = (productId) => {
    const found = products.find((p) => p.id === productId);
    setSelectedProduct(found);
    setForm((prev) => ({
      ...prev,
      product_id: productId,
      unit_price: prev.type === "exit" ? (found?.sale_price || 0) : (found?.purchase_price || 0),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const product = selectedProduct;
    let newStock = product.stock || 0;

    if (form.type === "entry" || form.type === "return") {
      newStock += form.quantity;
    } else if (form.type === "exit") {
      newStock -= form.quantity;
    } else {
      newStock = form.quantity; // Adjustment sets absolute
    }

    await base44.entities.Movement.create({
      ...form,
      product_name: product.name,
      total: form.quantity * form.unit_price,
      stock_after: newStock,
    });

    await base44.entities.Product.update(product.id, { stock: newStock });

    setSaving(false);
    onSaved();
    onOpenChange(false);
  };

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>

        {/* Barcode scanner input */}
        <div className="flex gap-2 pt-2">
          <Input
            placeholder="Escanee código de barras o SKU..."
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBarcodeSearch()}
            className="flex-1"
          />
          <Button variant="outline" onClick={handleBarcodeSearch}>
            <ScanLine className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Producto *</Label>
            <Select value={form.product_id} onValueChange={handleProductSelect}>
              <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — Stock: {p.stock} {p.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <p className="font-medium text-slate-700">{selectedProduct.name}</p>
              <p className="text-slate-500">Stock actual: <span className="font-semibold">{selectedProduct.stock} {selectedProduct.unit}</span></p>
            </div>
          )}

          <div>
            <Label>Tipo de movimiento *</Label>
            <Select value={form.type} onValueChange={(v) => {
              updateField("type", v);
              if (selectedProduct) {
                updateField("unit_price", v === "exit" ? selectedProduct.sale_price : selectedProduct.purchase_price);
              }
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cantidad *</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => updateField("quantity", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Precio unitario</Label>
              <Input type="number" min={0} step="0.01" value={form.unit_price} onChange={(e) => updateField("unit_price", parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div className="bg-indigo-50 rounded-xl p-3 text-center">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-bold text-indigo-700">
              ${(form.quantity * form.unit_price).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div>
            <Label>Referencia</Label>
            <Input value={form.reference} onChange={(e) => updateField("reference", e.target.value)} placeholder="No. factura, orden..." />
          </div>
          <div>
            <Label>Motivo / Notas</Label>
            <Textarea value={form.reason} onChange={(e) => updateField("reason", e.target.value)} placeholder="Opcional" rows={2} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.product_id || !form.quantity || saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}