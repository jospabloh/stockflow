import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, ScanLine, Search } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const PAYMENT_METHODS = [
  "Efectivo", "Transferencia", "Tarjeta de crédito", "Tarjeta de débito",
  "Cheque", "Depósito bancario", "Por definir",
];

export default function QuotationFormDialog({ open, onOpenChange, quotation, onSaved }) {
  const barcodeRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [applyTax, setApplyTax] = useState(true);
  const [taxRate, setTaxRate] = useState(16);
  const [taxLabel, setTaxLabel] = useState("IVA");
  const [form, setForm] = useState({
    client_name: "", client_email: "", client_phone: "",
    items: [], notes: "", valid_until: "", status: "draft",
    payment_method: "Por definir",
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
          payment_method: quotation.payment_method || "Por definir",
        });
        setApplyTax(quotation.tax > 0);
        if (quotation.tax > 0 && quotation.subtotal > 0) {
          setTaxRate(Math.round((quotation.tax / quotation.subtotal) * 100));
        }
      } else {
        setForm({
          client_name: "", client_email: "", client_phone: "",
          items: [], notes: "", valid_until: "", status: "draft",
          payment_method: "Por definir",
        });
        setApplyTax(true);
        setTaxRate(16);
        setTaxLabel("IVA");
      }
      setBarcodeInput("");
      setBarcodeNotFound(false);
      setTimeout(() => barcodeRef.current?.focus(), 150);
    }
  }, [open, quotation]);

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;
    const found = products.find(
      (p) => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim()
    );
    if (found) {
      setBarcodeNotFound(false);
      // Check if already in items, increase qty
      const existingIdx = form.items.findIndex(i => i.product_id === found.id);
      if (existingIdx >= 0) {
        const items = [...form.items];
        items[existingIdx] = {
          ...items[existingIdx],
          quantity: items[existingIdx].quantity + 1,
          total: (items[existingIdx].quantity + 1) * items[existingIdx].unit_price,
        };
        setForm(prev => ({ ...prev, items }));
      } else {
        setForm(prev => ({
          ...prev,
          items: [...prev.items, {
            product_id: found.id,
            product_name: found.name,
            quantity: 1,
            unit_price: found.sale_price,
            total: found.sale_price,
          }],
        }));
      }
      setBarcodeInput("");
    } else {
      setBarcodeNotFound(true);
    }
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: "", product_name: "", quantity: 1, unit_price: 0, total: 0 }],
    }));
  };

  const removeItem = (index) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
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
  const taxAmount = applyTax ? subtotal * (taxRate / 100) : 0;
  const total = subtotal + taxAmount;

  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...form,
      subtotal,
      tax: taxAmount,
      total,
      tax_rate: applyTax ? taxRate : 0,
      tax_label: applyTax ? taxLabel : "",
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

        <div className="space-y-5 pt-2">
          {/* Client info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Cliente *</Label>
              <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Nombre del cliente" />
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

          {/* Barcode scanner */}
          <div className="space-y-1">
            <Label>Escanear producto</Label>
            <div className="flex gap-2">
              <Input
                ref={barcodeRef}
                placeholder="🔫 Escanee código de barras o SKU y presione Enter..."
                value={barcodeInput}
                onChange={(e) => { setBarcodeInput(e.target.value); setBarcodeNotFound(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleBarcodeSearch()}
                className={barcodeNotFound ? "border-red-400 focus-visible:ring-red-300" : ""}
              />
              <Button variant="outline" type="button" onClick={handleBarcodeSearch}>
                <ScanLine className="h-4 w-4" />
              </Button>
            </div>
            {barcodeNotFound && (
              <p className="text-xs text-red-500 pl-1">Código no encontrado. Verifica el SKU o código de barras.</p>
            )}
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Productos ({form.items.length})</Label>
              <Button variant="outline" size="sm" type="button" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Agregar manualmente
              </Button>
            </div>
            <div className="space-y-2">
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
                  <div className="col-span-4 md:col-span-3">
                    <Label className="text-xs">Precio unitario</Label>
                    <Input type="number" min={0} step="0.01" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <Label className="text-xs">Total</Label>
                    <p className="h-9 flex items-center font-semibold text-slate-700 text-sm">${(item.total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" type="button" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
              {form.items.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8 bg-slate-50 rounded-xl">Agrega productos escaneando o manualmente</p>
              )}
            </div>
          </div>

          {/* Tax & totals */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">${subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch checked={applyTax} onCheckedChange={setApplyTax} />
                <Input
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  className="w-20 h-7 text-xs"
                  placeholder="IVA"
                  disabled={!applyTax}
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-16 h-7 text-xs"
                    disabled={!applyTax}
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              </div>
              <span className="font-medium text-sm">{applyTax ? `$${taxAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "Sin impuesto"}</span>
            </div>
            <div className="flex justify-between text-lg border-t pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-indigo-700">${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Payment, validity, notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Forma de pago</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vigencia</Label>
              <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
            <div>
              <Label>Notas / Condiciones</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Condiciones de pago, entrega..." rows={2} />
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