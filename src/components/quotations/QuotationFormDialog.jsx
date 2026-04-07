import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, ScanLine, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import SelectWrapper from "@/components/wrappers/SelectWrapper";
import { useBusinessContext } from "@/components/BusinessContext";
import { createButtonProps } from "@/lib/a11y";
import { calculatePrice, computeCategoryQtyMap } from "@/lib/pricingEngine";
import ProductSearchInput from "@/components/movements/ProductSearchInput";
import { calculateTotalsWithReconciliation, formatMXN } from "@/lib/vatCalculator";



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
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
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
      Promise.all([
        base44.entities.Product.filter({ business_id: businessId, status: "active" }),
        base44.entities.Category.filter({ business_id: businessId }),
        base44.entities.Client.filter({ business_id: businessId, status: "active" }),
        base44.entities.PaymentMethod.filter({ business_id: businessId, active: true }),
      ]).then(([prods, cats, cls, pms]) => {
        setProducts(prods);
        setCategories(cats);
        setClients(cls);
        setPaymentMethods(pms);
      });
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

  // Build a product map for quick lookup
  const productMap = React.useMemo(() => {
    const m = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  // Build a category map for quick lookup
  const categoryMap = React.useMemo(() => {
    const m = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  // Recalculate a set of items applying category-level qty wholesale logic
  const recalcAllItems = (items, newPriceInfo = {}) => {
    const catQtyMap = computeCategoryQtyMap(items, productMap);
    const recalcedItems = items.map((item, idx) => {
      const product = productMap[item.product_id];
      if (!product) return item;
      const category = categoryMap[product.category];
      const categoryQty = catQtyMap[product.category || "__none__"] || 0;
      const { price, rule, origin, warning } = calculatePrice({
        product, client: selectedClient, quantity: item.quantity, category, categoryQty,
      });
      newPriceInfo[idx] = { rule, origin, warning };
      return { ...item, unit_price: price, total: item.quantity * price };
    });
    return { recalcedItems, newPriceInfo };
  };

  // Recalculate ALL item prices when selected client or categories change
  useEffect(() => {
    if (!open || products.length === 0) return;
    setForm(prev => {
      const newPriceInfo = {};
      const { recalcedItems, newPriceInfo: pi } = recalcAllItems(prev.items, newPriceInfo);
      setItemPriceInfo(pi);
      return { ...prev, items: recalcedItems };
    });
  }, [selectedClient, open, products, categories]);

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;
    const found = products.find(p => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim());
    if (found) {
      setBarcodeNotFound(false);
      setForm(prev => {
        const existingIdx = prev.items.findIndex(i => i.product_id === found.id);
        let items = [...prev.items];
        if (existingIdx >= 0) {
          items[existingIdx] = { ...items[existingIdx], quantity: items[existingIdx].quantity + 1 };
        } else {
          items.push({
            product_id: found.id,
            product_name: found.name,
            quantity: 1,
            unit_price: 0,
            total: 0,
            tax_rate: found.tax_rate ?? 16,
            available_stock: found.stock ?? 0,
          });
        }
        const { recalcedItems, newPriceInfo } = recalcAllItems(items, {});
        setItemPriceInfo(newPriceInfo);
        return { ...prev, items: recalcedItems };
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
      let items = [...prev.items];
      items[index] = { ...items[index], [field]: value };

      if (field === "product_id") {
        const product = productMap[value];
        if (product) {
          items[index].product_name = product.name;
          items[index].tax_rate = product.tax_rate ?? 16;
          items[index].available_stock = product.stock ?? 0;
        }
        // Recalc all (category qty map may change)
        const { recalcedItems, newPriceInfo } = recalcAllItems(items, {});
        setItemPriceInfo(newPriceInfo);
        return { ...prev, items: recalcedItems };
      } else if (field === "quantity") {
        // Recalc all (category totals change)
        const { recalcedItems, newPriceInfo } = recalcAllItems(items, {});
        setItemPriceInfo(newPriceInfo);
        return { ...prev, items: recalcedItems };
      } else if (field === "unit_price") {
        // Manual override — clear price info for this item only, keep others
        setItemPriceInfo(pi => ({ ...pi, [index]: null }));
        items[index].total = (items[index].quantity || 0) * (Number(value) || 0);
        return { ...prev, items };
      }

      return { ...prev, items };
    });
  };

  // Calculate totals with precise VAT handling and reconciliation
  const { subtotal, tax: taxAmount, total } = calculateTotalsWithReconciliation(form.items);

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
    return `${datePrefix}-${String(todayCount + 1).padStart(4, "0")}`;

  };

  const handleSave = async () => {
    // OB8: Validar antes de intentar guardar y mostrar error claro
    if (!form.client_name?.trim()) {
      toast.error("⚠️ El nombre del cliente es requerido");
      return;
    }
    if (form.items.length === 0) {
      toast.error("⚠️ Agrega al menos un producto a la cotización");
      return;
    }
    const overStock = form.items.find(i => i.available_stock !== undefined && i.quantity > i.available_stock);
    if (overStock) {
      toast.error(`⚠️ Stock insuficiente para "${overStock.product_name}": disponible ${overStock.available_stock}, solicitado ${overStock.quantity}`);
      return;
    }

    setSaving(true);
    try {
      const folio = quotation?.folio || await generateFolio();
      const data = { ...form, subtotal, tax: taxAmount, total, folio };
      if (quotation) {
        const response = await base44.functions.invoke('updateQuotationSafe', { quotation_id: quotation.id, updates: data });
        if (!response.data.success) {
          toast.error(`⚠️ No se pudo guardar: ${response.data.error || "Error desconocido"}`);
          setSaving(false);
          return;
        }
      } else {
        const response = await base44.functions.invoke('createQuotationSafe', { ...data, business_id: businessId });
        if (!response.data.success) {
          toast.error(`⚠️ No se pudo guardar: ${response.data.error || "Error desconocido"}`);
          setSaving(false);
          return;
        }
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(`⚠️ Error inesperado: ${error.message || "Intenta nuevamente"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
          <DialogTitle>{quotation ? "Editar Cotización" : "Nueva Cotización"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
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
              {showClientSuggestions && clientSearch && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {(() => {
                    const q = clientSearch.toLowerCase();
                    const filtered = clients.filter(c =>
                      c.name.toLowerCase().includes(q) || (c.business_name || "").toLowerCase().includes(q)
                    );
                    if (filtered.length === 0) {
                      return <p className="text-sm text-slate-400 px-3 py-2">Sin coincidencias — se guardará como nuevo</p>;
                    }
                    return filtered.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm border-b border-slate-50 last:border-0"
                        onMouseDown={() => {
                          setForm(prev => ({ ...prev, client_id: c.id, client_name: c.business_name || c.name, client_email: c.email || "", client_phone: c.phone || "" }));
                          setSelectedClient(c);
                          setClientSearch("");
                          setShowClientSuggestions(false);
                        }}
                      >
                        <p className="font-medium text-foreground">{c.business_name || c.name}</p>
                        {c.business_name && <p className="text-xs text-muted-foreground">{c.name}</p>}
                        {(c.email || c.phone) && (
                          <p className="text-xs text-slate-400">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
                        )}
                        {(c.force_purchase_all_products || c.force_wholesale_all_products) && (
                          <p className="text-[10px] text-indigo-500 font-medium">
                            ⚡ {c.force_purchase_all_products ? "Precio compra forzado" : "Precio mayoreo forzado"}
                          </p>
                        )}
                      </button>
                    ));
                  })()}
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
                    <ProductSearchInput
                      products={products}
                      selectedProduct={products.find(p => p.id === item.product_id) || null}
                      onSelect={(pid) => updateItem(idx, "product_id", pid)}
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
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded cursor-default ${item.tax_rate === 16 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"}`}
                      title={item.tax_rate === 16 ? "IVA 16% — incluido en precio del producto" : "IVA 0% (Excento) — no incluye impuesto"}
                    >
                      {item.tax_rate === 16 ? "IVA 16%" : "Excento"}
                    </span>
                    {selectedClient && (selectedClient.force_purchase_all_products || selectedClient.force_wholesale_all_products) && (
                      <span className="text-[10px] text-indigo-500 font-semibold mt-1">
                        {selectedClient.force_purchase_all_products ? "Compra" : "Mayoreo"}
                      </span>
                    )}
                    {selectedClient?.force_purchase_all_products && (
                      <span className="text-lg mt-1" title="Transporte 20 MXN">🚚</span>
                    )}
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

          {/* Info note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-[11px] text-blue-700"><strong>ℹ️ Nota:</strong> Los precios de productos con IVA incluyen el impuesto. El subtotal se calcula restando el IVA de esos precios.</p>
          </div>

          {/* Tax & totals breakdown */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Subtotal (neto)</span>
              <span className="font-semibold text-foreground">${formatMXN(subtotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between items-center text-muted-foreground text-xs">
                <span>IVA 16% (desglose de incluidos)</span>
                <span className="text-amber-600 font-semibold">${formatMXN(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-lg font-bold border-t border-border pt-3 bg-foreground/10 -mx-4 px-4 py-3 rounded">
              <span className="text-foreground">Total a pagar</span>
              <span className="text-foreground">${formatMXN(total)}</span>
            </div>
            {form.items.length > 0 && (
              <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">
                ✓ Cálculo: Subtotal ({formatMXN(subtotal)}) + IVA ({formatMXN(taxAmount)}) = Total ({formatMXN(total)})
              </div>
            )}
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
                options={paymentMethods.map(m => ({ value: m.name, label: m.name }))}
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
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0 bg-card">
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