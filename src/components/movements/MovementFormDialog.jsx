import React, { useState, useEffect, useRef } from "react";
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
import { MobileSelect } from "@/components/ui/MobileSelect";
import { Save, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useBusinessContext } from "@/components/BusinessContext";

const TYPES = [
  { value: "entry", label: "Entrada (Compra)" },
  { value: "exit", label: "Salida (Venta)" },
  { value: "return", label: "Devolución" },
  { value: "adjustment", label: "Ajuste" },
];

export default function MovementFormDialog({ open, onOpenChange, onSaved }) {
  const { businessId } = useBusinessContext();
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
      setBarcodeNotFound(false);
      // Autofocus en el campo de código de barras al abrir
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  }, [open]);

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;
    const found = products.find(
      (p) => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim()
    );
    if (found) {
      setBarcodeNotFound(false);
      setSelectedProduct(found);
      setForm((prev) => ({
        ...prev,
        product_id: found.id,
        unit_price: prev.type === "exit" ? found.sale_price : found.purchase_price,
      }));
      setBarcodeInput("");
    } else {
      setBarcodeNotFound(true);
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

    // BUG-014: Validar stock suficiente para salidas
    if (form.type === "exit" && newStock < form.quantity) {
      toast.error(`Stock insuficiente. Solo hay ${newStock} unidad(es) disponibles de "${product.name}".`);
      setSaving(false);
      return;
    }

    if (form.type === "entry" || form.type === "return") {
      newStock += form.quantity;
    } else if (form.type === "exit") {
      newStock -= form.quantity;
    } else if (form.type === "adjustment") {
      newStock = form.quantity;
    }

    // Optimistic: close immediately and notify parent with projected stock
    onSaved({ productId: product.id, newStock, _optimistic: true });
    onOpenChange(false);

    await base44.entities.Movement.create({
      ...form,
      product_name: product.name,
      total: form.quantity * form.unit_price,
      stock_after: newStock,
      business_id: businessId,
    });

    await base44.entities.Product.update(product.id, { stock: newStock });

    setSaving(false);
    // Final reconcile after network
    onSaved({ _reconcile: true });
  };

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>

        {/* Barcode scanner input */}
        <div className="space-y-1 pt-2">
          <div className="flex gap-2">
            <Input
              ref={barcodeRef}
              placeholder="🔫 Escanee código de barras o SKU..."
              value={barcodeInput}
              onChange={(e) => { setBarcodeInput(e.target.value); setBarcodeNotFound(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleBarcodeSearch()}
              className={`flex-1 ${barcodeNotFound ? "border-red-400 focus-visible:ring-red-300" : ""}`}
            />
            <Button variant="outline" onClick={handleBarcodeSearch}>
              <ScanLine className="h-4 w-4" />
            </Button>
          </div>
          {barcodeNotFound && (
            <p className="text-xs text-red-500 pl-1">Código no encontrado. Verifica el SKU o código de barras del producto.</p>
          )}
        </div>

        <div className="space-y-4">
          {form.type === "adjustment" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              ⚠️ El <strong>ajuste</strong> establece el stock final de forma absoluta. Ejemplo: si ingresas 10, el stock quedará en 10 unidades.
            </div>
          )}
          <div>
            <Label>Producto *</Label>
            <MobileSelect
              value={form.product_id}
              onValueChange={handleProductSelect}
              placeholder="Seleccionar producto"
              options={products.map((p) => ({
                value: p.id,
                label: `${p.name} — Stock: ${p.stock} ${p.unit}`,
              }))}
            />
          </div>

          {selectedProduct && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <p className="font-medium text-slate-700">{selectedProduct.name}</p>
              <p className="text-slate-500">Stock actual: <span className="font-semibold">{selectedProduct.stock} {selectedProduct.unit}</span></p>
            </div>
          )}

          <div>
            <Label>Tipo de movimiento *</Label>
            <MobileSelect
              value={form.type}
              onValueChange={(v) => {
                updateField("type", v);
                if (selectedProduct) {
                  updateField("unit_price", v === "exit" ? selectedProduct.sale_price : selectedProduct.purchase_price);
                }
              }}
              placeholder="Tipo"
              options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{form.type === "adjustment" ? "Stock absoluto nuevo (valor final) *" : "Cantidad *"}</Label>
              <Input type="number" min={0} value={form.quantity} onChange={(e) => updateField("quantity", parseInt(e.target.value) || 0)} />
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