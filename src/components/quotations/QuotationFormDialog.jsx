import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, ScanLine, AlertTriangle } from "lucide-react";
import SelectWrapper from "@/components/wrappers/SelectWrapper";
import { useBusinessContext } from "@/components/BusinessContext";
import { createButtonProps, createTableProps } from "@/lib/a11y";

const PAYMENT_METHODS = [
  "Efectivo", "Transferencia", "Tarjeta de crédito", "Tarjeta de débito",
  "Cheque", "Depósito bancario", "Por definir",
];

export default function QuotationFormDialog({ open, onOpenChange, quotation, onSaved }) {
  const { businessId } = useBusinessContext();
  const barcodeRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [taxLabel, setTaxLabel] = useState("IVA");
  const [form, setForm] = useState({
    client_name: "", client_email: "", client_phone: "",
    items: [], notes: "", valid_until: "", status: "draft",
    payment_method: "Por definir",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && businessId) {
      base44.entities.Product.filter({ business_id: businessId, status: "active" }).then(setProducts);
      base44.entities.Client.filter({ business_id: businessId, status: "active" }).then(setClients);
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
        setTaxLabel("IVA");
      } else {
        setForm({
          client_name: "", client_email: "", client_phone: "",
          items: [], notes: "", valid_until: "", status: "draft",
          payment_method: "Por definir",
        });
        setTaxLabel("IVA");
        setClientSearch("");
      }
      setBarcodeInput("");
      setBarcodeNotFound(false);
      setTimeout(() => barcodeRef.current?.focus(), 150);
    }
  }, [open, quotation, businessId]);

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;
    const found = products.find(
      (p) => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim()
    );
    if (found) {
      setBarcodeNotFound(false);
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
            tax_rate: found.tax_rate ?? 16,
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
      items: [...prev.items, { product_id: "", product_name: "", quantity: 1, unit_price: 0, total: 0, tax_rate: 16 }],
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
          items[index].tax_rate = product.tax_rate ?? 16;
          items[index].available_stock = product.stock ?? 0;
        }
      }
      if (field === "quantity" || field === "unit_price") {
        items[index].total = (items[index].quantity || 0) * (items[index].unit_price || 0);
      }
      return { ...prev, items };
    });
  };

  const subtotal = form.items.reduce((sum, item) => sum + (item.total || 0), 0);
  const taxableSubtotal = form.items.reduce((sum, item) => (item.tax_rate > 0 ? sum + (item.total || 0) : sum), 0);
  const taxAmount = taxableSubtotal * 0.16;
  const total = subtotal + taxAmount;

  const generateFolio = async () => {
    // Use Mexico City local time to generate the date prefix
    const now = new Date();
    const mxDate = new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      year: "2-digit", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const yy = mxDate.find(p => p.type === "year").value;
    const mm = mxDate.find(p => p.type === "month").value;
    const dd = mxDate.find(p => p.type === "day").value;
    const datePrefix = `COT-${yy}${mm}${dd}`;
    // Fetch all quotations for this business to count today's folios correctly
    const all = await base44.entities.Quotation.filter({ business_id: businessId }, "-created_date", 2000);
    const todayCount = all.filter(q => q.folio && q.folio.startsWith(datePrefix)).length;
    const seq = String(todayCount).padStart(4, "0");
    return `${datePrefix}-${seq}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const folio = quotation?.folio || await generateFolio();
      const data = {
        ...form,
        subtotal,
        tax: taxAmount,
        total,
        folio,
      };
      if (quotation) {
        // SECURITY: Validate ownership before update
        const validation = await fetch('/api/functions/validateBusinessOwnership', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            entity_name: 'Quotation',
            record_id: quotation.id,
            operation: 'update'
          })
        });
        const validResult = await validation.json();
        if (!validResult.valid) {
          alert("⚠️ No tienes permiso para modificar esta cotización");
          return;
        }
        
        await base44.entities.Quotation.update(quotation.id, data);
      } else {
        const response = await base44.functions.invoke('createQuotationSafe', { ...data, business_id: businessId });
        if (!response.data.success) {
          toast.error(`Error: ${response.data.error}`);
          setSaving(false);
          return;
        }
      }
      // Solo cerrar DESPUÉS de guardar exitosamente
      onSaved();
      onOpenChange(false);
    } catch (error) {
      // Error se maneja, diálogo permanece abierto
    } finally {
      setSaving(false);
    }
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
            <div className="relative">
              <Label className="text-foreground mb-1.5 block">Cliente *</Label>
              <Input
                value={clientSearch || form.client_name}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setForm({ ...form, client_name: e.target.value, client_email: "", client_phone: "" });
                  setShowClientSuggestions(true);
                }}
                onFocus={() => setShowClientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowClientSuggestions(false), 150)}
                placeholder="Buscar o escribir cliente..."
              />
              {showClientSuggestions && (clientSearch || form.client_name) && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {clients
                    .filter(c => c.name.toLowerCase().includes((clientSearch || form.client_name).toLowerCase()))
                    .map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm border-b border-slate-50 last:border-0"
                        onMouseDown={() => {
                        setForm({ ...form, client_id: c.id, client_name: c.name, client_email: c.email || "", client_phone: c.phone || "" });
                          setClientSearch("");
                          setShowClientSuggestions(false);
                        }}
                      >
                        <p className="font-medium text-slate-700">{c.name}</p>
                        {(c.email || c.phone) && (
                          <p className="text-xs text-slate-400">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
                        )}
                      </button>
                    ))}
                  {clients.filter(c => c.name.toLowerCase().includes((clientSearch || form.client_name).toLowerCase())).length === 0 && (
                    <p className="text-sm text-slate-400 px-3 py-2">Sin coincidencias — se guardará como nuevo</p>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Email</Label>
              <Input value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="correo@email.com" />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Teléfono</Label>
              <Input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} placeholder="Teléfono" />
            </div>
          </div>

          {/* Barcode scanner */}
          <div className="space-y-2">
            <Label className="text-foreground mb-1.5 block">Escanear producto</Label>
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
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-card border border-border rounded-xl p-3">
                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-xs text-foreground mb-1.5 block" htmlFor={`product-${idx}`}>Producto</Label>
                    <SelectWrapper
                      id={`product-${idx}`}
                      value={item.product_id}
                      onValueChange={(v) => updateItem(idx, "product_id", v)}
                      placeholder="Seleccionar"
                      options={products.map((p) => ({ value: p.id, label: p.name }))}
                      aria-label={`Producto ${idx + 1}`}
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <Label className="text-xs text-foreground mb-1.5 block">Cantidad</Label>
                    <Input
                      type="number" min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                      className={item.available_stock !== undefined && item.quantity > item.available_stock ? "border-red-400 focus-visible:ring-red-300" : ""}
                    />
                    {item.available_stock !== undefined && item.quantity > item.available_stock && (
                      <p className="text-[10px] text-red-600 mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Solo {item.available_stock} en stock
                      </p>
                    )}
                  </div>
                  <div className="col-span-4 md:col-span-3">
                    <Label className="text-xs text-foreground mb-1.5 block">Precio unitario</Label>
                    <Input type="number" min={0} step="0.01" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <Label className="text-xs text-foreground mb-1.5 block">Total</Label>
                    <p className="h-9 flex items-center font-bold text-foreground text-sm">${(item.total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="col-span-1 hidden md:flex flex-col items-center justify-end pb-1">
                    <button
                      type="button"
                      onClick={() => updateItem(idx, "tax_rate", item.tax_rate > 0 ? 0 : 16)}
                      className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.tax_rate > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-400"}`}
                      title="Clic para cambiar IVA del ítem"
                    >
                      {item.tax_rate > 0 ? "IVA" : "0%"}
                    </button>
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
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Subtotal (todos los productos)</span>
              <span className="font-semibold text-foreground">${subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            {taxableSubtotal > 0 && (
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Base gravable (productos con IVA 16%)</span>
                <span className="text-foreground">${taxableSubtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-border pt-3">
              <span className="text-muted-foreground">IVA 16%</span>
              <span className="font-semibold text-foreground">${taxAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold border-t border-border pt-3 bg-accent/10 -mx-4 px-4 py-3 rounded">
              <span className="text-foreground">Total</span>
              <span className="text-accent">${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Payment, validity, notes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div>
             <Label htmlFor="payment-method" className="text-foreground mb-1.5 block">Forma de pago</Label>
             <SelectWrapper
               id="payment-method"
               value={form.payment_method}
               onValueChange={(v) => setForm({ ...form, payment_method: v })}
               placeholder="Seleccionar"
               options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
               aria-label="Método de pago"
             />
           </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Vigencia</Label>
              <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Notas / Condiciones</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Condiciones de pago, entrega..." rows={2} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} {...createButtonProps('cancel')}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.client_name || form.items.length === 0 || saving || form.items.some(i => i.available_stock !== undefined && i.quantity > i.available_stock)} className="bg-indigo-600 hover:bg-indigo-700" {...createButtonProps('save')}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}