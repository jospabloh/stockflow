import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, ScanLine, AlertTriangle, Info } from "lucide-react";
import SelectWrapper from "@/components/wrappers/SelectWrapper";
import { useBusinessContext } from "@/components/BusinessContext";
import { createButtonProps } from "@/lib/a11y";
import { calculatePrice } from "@/lib/pricingEngine";

const PAYMENT_METHODS = [
  "Efectivo", "Transferencia", "Tarjeta de crédito", "Tarjeta de débito",
  "Cheque", "Depósito bancario", "Por definir",
];

function PriceInfo({ rule, origin, warning }) {
  if (!origin) return null;
  return (
    <div className={`mt-1 px-2 py-1 rounded text-[10px] flex items-start gap-1 ${warning ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-600"}`}>
      {warning ? <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> : <Info className="h-3 w-3 shrink-0 mt-0.5" />}
      <span>{warning || origin}</span>
    </div>
  );
}

export default function QuotationFormDialog({ open, onOpenChange, quotation, onSaved }) {
  const { businessId } = useBusinessContext();
  const barcodeRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [itemPriceInfo, setItemPriceInfo] = useState({});
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
        // Try to find the selected client
        if (quotation.client_id) {
          base44.entities.Client.filter({ id: quotation.client_id, business_id: businessId }).then(res => {
            if (res.length > 0) setSelectedClient(res[0]);
          });
        }
      } else {
        setForm({
          client_name: "", client_email: "", client_phone: "",
          items: [], notes: "", valid_until: "", status: "draft",
          payment_method: "Por definir",
        });
        setSelectedClient(null);
        setClientSearch("");
      }
      setItemPriceInfo({});
      setBarcodeInput("");
      setBarcodeNotFound(false);
      setTimeout(() => barcodeRef.current?.focus(), 150);
    }
  }, [open, quotation, businessId]);

  // Recalculate ALL item prices when selected client changes
  useEffect(() => {
    if (!open) return;
    setForm(prev => {
      const newItems = prev.items.map((item, idx) => {
        const product = products.find(p => p.id === item.product_id);
        if (!product) return item;
        const { price, rule, origin, warning } = calculatePrice({ product, client: selectedClient, quantity: item.quantity });
        setItemPriceInfo(pi => ({ ...pi, [idx]: { rule, origin, warning } }));
        return {
          ...item,
          unit_price: price,
          total: item.quantity * price,
        };
      });
      return { ...prev, items: newItems };
    });
  }, [selectedClient, open]);

  const applyPricingToItem = (item, product, quantity, idx) => {
    const { price, rule, origin, warning } = calculatePrice({ product, client: selectedClient, quantity });
    setItemPriceInfo(pi => ({ ...pi, [idx]: { rule, origin, warning } }));
    return { ...item, unit_price: price, total: quantity * price };
  };

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;
    const found = products.find(p => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim());
    if (found) {
      setBarcodeNotFound(false);
      setForm(prev => {
        const existingIdx = prev.items.findIndex(i => i.product_id === found.id);
        const items = [...prev.items];
        if (existingIdx >= 0) {
          const newQty = items[existingIdx].quantity + 1;
          const updated = applyPricingToItem(items[existingIdx], found, newQty, existingIdx);
          items[existingIdx] = { ...updated, quantity: newQty };
        } else {
          const newIdx = items.length;
          const { price, rule, origin, warning } = calculatePrice({ product: found, client: selectedClient, quantity: 1 });
          setItemPriceInfo(pi => ({ ...pi, [newIdx]: { rule, origin, warning } }));
          items.push({
            product_id: found.id,
            product_name: found.name,
            quantity: 1,
            unit_price: price,
            total: price,
            tax_rate: found.tax_rate ?? 16,
            available_stock: found.stock ?? 0,
          });
        }
        return { ...prev, items };
      });
      setBarcodeInput("");
    } else {
      setBarcodeNotFound(true);
    }
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: "", product_name: "", quantity: 1, unit_price: 0, total: 0, tax_rate: 16 }],
    }));
  };

  const removeItem = (index) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
    setItemPriceInfo(pi => {
      const next = {};
      Object.entries(pi).forEach(([k, v]) => {
        const ki = parseInt(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
  };

  const updateItem = (index, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };

      if (field === "product_id") {
        const product = products.find(p => p.id === value);
        if (product) {
          const qty = items[index].quantity || 1;
          const { price, rule, origin, warning } = calculatePrice({ product, client: selectedClient, quantity: qty });
          setItemPriceInfo(pi => ({ ...pi, [index]: { rule, origin, warning } }));
          items[index].product_name = product.name;
          items[index].unit_price = price;
          items[index].total = qty * price;
          items[index].tax_rate = product.tax_rate ?? 16;
          items[index].available_stock = product.stock ?? 0;
        }
      } else if (field === "quantity") {
        const product = products.find(p => p.id === items[index].product_id);
        if (product) {
          const qty = Number(value) || 1;
          const { price, rule, origin, warning } = calculatePrice({ product, client: selectedClient, quantity: qty });
          setItemPriceInfo(pi => ({ ...pi, [index]: { rule, origin, warning } }));
          items[index].unit_price = price;
          items[index].total = qty * price;
        } else {
          items[index].total = (items[index].quantity || 0) * (items[index].unit_price || 0);
        }
      } else if (field === "unit_price") {
        // Manual override — clear price info
        setItemPriceInfo(pi => ({ ...pi, [index]: null }));
        items[index].total = (items[index].quantity || 0) * (Number(value) || 0);
      }

      return { ...prev, items };
    });
  };

  const subtotal = form.items.reduce((sum, item) => sum + (item.total || 0), 0);
  const taxableSubtotal = form.items.reduce((sum, item) => (item.tax_rate > 0 ? sum + (item.total || 0) : sum), 0);
  const taxAmount = taxableSubtotal * 0.16;
  const total = subtotal + taxAmount;

  const generateFolio = async () => {
    const now = new Date();
    const mxDate = new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      year: "2-digit", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const yy = mxDate.find(p => p.type === "year").value;
    const mm = mxDate.find(p => p.type === "month").value;
    const dd = mxDate.find(p => p.type === "day").value;
    const datePrefix = `COT-${yy}${mm}${dd}`;
    const all = await base44.entities.Quotation.filter({ business_id: businessId }, "-created_date", 2000);
    const todayCount = all.filter(q => q.folio && q.folio.startsWith(datePrefix)).length;
    return `${datePrefix}-${String(todayCount).padStart(4, "0")}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const folio = quotation?.folio || await generateFolio();
      const data = { ...form, subtotal, tax: taxAmount, total, folio };
      if (quotation) {
        const validation = await fetch('/api/functions/validateBusinessOwnership', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_name: 'Quotation', record_id: quotation.id, operation: 'update' })
        });
        const validResult = await validation.json();
        if (!validResult.valid) {
          alert("⚠️ No tienes permiso para modificar esta cotización");
          return;
        }
        const response = await base44.functions.invoke('updateQuotationSafe', { quotation_id: quotation.id, updates: data });
        if (!response.data.success) {
          setSaving(false);
          return;
        }
      } else {
        const response = await base44.functions.invoke('createQuotationSafe', { ...data, business_id: businessId });
        if (!response.data.success) {
          setSaving(false);
          return;
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      // keep dialog open on error
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
                  setForm(prev => ({ ...prev, client_name: e.target.value, client_email: "", client_phone: "" }));
                  setSelectedClient(null);
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
                          setForm(prev => ({ ...prev, client_id: c.id, client_name: c.name, client_email: c.email || "", client_phone: c.phone || "" }));
                          setSelectedClient(c);
                          setClientSearch("");
                          setShowClientSuggestions(false);
                        }}
                      >
                        <p className="font-medium text-slate-700">{c.name}</p>
                        {c.business_name && (
                          <p className="text-xs text-indigo-500 font-medium">{c.business_name}</p>
                        )}
                        {(c.email || c.phone) && (
                          <p className="text-xs text-slate-400">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
                        )}
                        {(c.force_purchase_all_products || c.force_wholesale_all_products) && (
                          <p className="text-[10px] text-indigo-500 font-medium">
                            ⚡ {c.force_purchase_all_products ? "Precio compra forzado" : "Precio mayoreo forzado"}
                          </p>
                        )}
                      </button>
                    ))}
                  {clients.filter(c => c.name.toLowerCase().includes((clientSearch || form.client_name).toLowerCase())).length === 0 && (
                    <p className="text-sm text-slate-400 px-3 py-2">Sin coincidencias — se guardará como nuevo</p>
                  )}
                </div>
              )}
              {selectedClient && (selectedClient.force_purchase_all_products || selectedClient.force_wholesale_all_products) && (
                <p className="text-[10px] text-indigo-600 font-medium mt-1">
                  ⚡ {selectedClient.force_purchase_all_products ? "Precio de compra activo para este cliente" : "Precio mayoreo activo para este cliente"}
                </p>
              )}
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Email</Label>
              <Input value={form.client_email} onChange={(e) => setForm(prev => ({ ...prev, client_email: e.target.value }))} placeholder="correo@email.com" />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Teléfono</Label>
              <Input value={form.client_phone} onChange={(e) => setForm(prev => ({ ...prev, client_phone: e.target.value }))} placeholder="Teléfono" />
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
                <div key={idx} className="grid grid-cols-12 gap-2 items-start bg-card border border-border rounded-xl p-3">
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
                      onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                      className={item.available_stock !== undefined && item.quantity > item.available_stock ? "border-red-400 focus-visible:ring-red-300" : ""}
                    />
                    {item.available_stock !== undefined && item.quantity > item.available_stock && (
                      <p className="text-[10px] text-red-600 mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Solo {item.available_stock} en stock
                      </p>
                    )}
                  </div>
                  <div className="col-span-4 md:col-span-3">
                    <Label className="text-xs text-foreground mb-1.5 block">Precio aplicado</Label>
                    <Input type="number" min={0} step="0.01" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                    {itemPriceInfo[idx] && (
                      <PriceInfo rule={itemPriceInfo[idx].rule} origin={itemPriceInfo[idx].origin} warning={itemPriceInfo[idx].warning} />
                    )}
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <Label className="text-xs text-foreground mb-1.5 block">Total</Label>
                    <p className="h-9 flex items-center font-bold text-foreground text-sm">${(item.total || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="col-span-1 hidden md:flex flex-col items-center justify-start pt-6">
                    <button
                      type="button"
                      onClick={() => updateItem(idx, "tax_rate", item.tax_rate > 0 ? 0 : 16)}
                      className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.tax_rate > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-400"}`}
                      title="Clic para cambiar IVA del ítem"
                    >
                      {item.tax_rate > 0 ? "IVA" : "0%"}
                    </button>
                  </div>
                  <div className="col-span-1 flex items-start pt-5">
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
                onValueChange={(v) => setForm(prev => ({ ...prev, payment_method: v }))}
                placeholder="Seleccionar"
                options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
                aria-label="Método de pago"
              />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Vigencia</Label>
              <Input type="date" value={form.valid_until} onChange={(e) => setForm(prev => ({ ...prev, valid_until: e.target.value }))} />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Notas / Condiciones</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Condiciones de pago, entrega..." rows={2} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} {...createButtonProps('cancel')}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!form.client_name || form.items.length === 0 || saving || form.items.some(i => i.available_stock !== undefined && i.quantity > i.available_stock)}
            className="bg-indigo-600 hover:bg-indigo-700"
            {...createButtonProps('save')}
          >
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}