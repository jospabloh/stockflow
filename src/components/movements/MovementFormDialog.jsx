import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { MobileSelect } from "@/components/ui/MobileSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { Save, ScanLine, Search, Plus, Trash2, CheckCircle2 } from "lucide-react";
import BarcodeCameraScanner from "@/components/products/BarcodeCameraScanner";
import { toast } from "sonner";
import { useBusinessContext } from "@/components/BusinessContext";
import { createButtonProps } from "@/lib/a11y";
import { calculatePrice } from "@/lib/pricingEngine";
import ProductSearchInput from "./ProductSearchInput";

const ALL_TYPES = [
  { value: "entry", label: "Entrada (Compra)" },
  { value: "exit", label: "Salida (Venta)" },
  { value: "return", label: "Devolución" },
  { value: "adjustment", label: "Ajuste (solo admin)" },
];

// Calcula precio para un producto según tipo, categorías y cliente seleccionado
function calcPrice(product, type, quantity, categories, client) {
if (!product) return 0;
if (type === "entry") return product.purchase_price ?? 0;
const category = categories.find(c => c.id === product.category);
const { price } = calculatePrice({
  product, client: client || null, quantity, category, categoryQty: quantity,
});
return price;
}

export default function MovementFormDialog({ open, onOpenChange, onSaved }) {
  const { businessId, user } = useBusinessContext();
  const isAdmin = user?.role === "admin";
  const barcodeRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Campos comunes del movimiento
  const [movType, setMovType] = useState("exit");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [clientId, setClientId] = useState("");
  const [isPaid, setIsPaid] = useState(false);

  // OB3: Lista de items (cada uno con producto + cantidad)
  const [items, setItems] = useState([{ product: null, quantity: 1 }]);

  useEffect(() => {
    if (open && businessId) {
      Promise.all([
        base44.entities.Product.filter({ status: "active", business_id: businessId }),
        base44.entities.Category.filter({ business_id: businessId }),
        base44.functions.invoke('getBusinessCatalogs', {}),
      ]).then(([prods, cats, catalogsRes]) => {
        setProducts(prods);
        setCategories(cats);
        const catalogs = catalogsRes?.data || {};
        setPaymentMethods(catalogs.paymentMethods || []);
        setClients(catalogs.clients || []);
        setSuppliers(catalogs.suppliers || []);
      });
      setMovType("exit");
      setPaymentMethodId("");
      setClientId("");
      setIsPaid(false);
      setItems([{ product: null, quantity: 1 }]);
      setBarcodeInput("");
      setBarcodeNotFound(false);
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  }, [open, businessId]);

  const assignProductByCode = (rawCode) => {
    const code = String(rawCode || "").trim();
    if (!code) return;

    const found = products.find(
      (p) => p.barcode === code || p.sku === code
    );

    setBarcodeInput(code);

    if (!found) {
      setBarcodeNotFound(true);
      toast.error("Código no encontrado");
      return;
    }

    setBarcodeNotFound(false);

    setItems((prev) => {
      const emptyIndex = prev.findIndex((item) => !item.product);

      if (emptyIndex >= 0) {
        return prev.map((item, i) =>
          i === emptyIndex ? { ...item, product: found } : item
        );
      }

      return [...prev, { product: found, quantity: 1 }];
    });

    setBarcodeInput("");
    toast.success(`Producto agregado: ${found.name}`);
  };

  const handleBarcodeSearch = () => {
    assignProductByCode(barcodeInput);
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, { product: null, quantity: 1 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  // Cliente seleccionado (objeto completo) para aplicar reglas de precio
  const selectedClient = useMemo(() => clients.find(c => c.id === clientId) || null, [clients, clientId]);

  // Total general
  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const price = calcPrice(item.product, movType, item.quantity, categories, selectedClient);
      return sum + (item.quantity * price);
    }, 0);
  }, [items, movType, categories, selectedClient]);

  const isAdjustment = movType === "adjustment";
  const needsParty = !isAdjustment; // entrada/salida/devolución requieren forma de pago y cliente/proveedor
  const canSave = items.some(i => i.product) && (!needsParty || (paymentMethodId && clientId)) && !saving;

  const handleSave = async () => {
    if (!items.some(i => i.product)) {
      toast.error("Selecciona al menos un producto");
      return;
    }
    if (needsParty && !paymentMethodId) {
      toast.error("⚠️ Selecciona la forma de pago");
      return;
    }
    if (needsParty && !clientId) {
      toast.error(movType === "entry" ? "⚠️ Selecciona el proveedor" : "⚠️ Selecciona el cliente");
      return;
    }

    setSaving(true);
    const pmName = paymentMethods.find(p => p.id === paymentMethodId)?.name || "";
    let clientName = "";
    if (movType === "entry") {
      const sup = suppliers.find(s => s.id === clientId);
      clientName = sup?.name || "";
    } else if (!isAdjustment) {
      const clientObj = clients.find(c => c.id === clientId);
      clientName = clientObj?.business_name || clientObj?.name || "";
    }

    const validItems = items.filter(i => i.product && i.quantity > 0);

    try {
      // Validar ownership del primer producto (representativo)
      const validResult = await base44.functions.invoke('validateBusinessOwnership', {
        entity_name: 'Product',
        record_id: validItems[0].product.id,
        operation: 'update',
      });
      if (!validResult.data?.valid) {
        toast.error("⚠️ No tienes permiso para modificar este producto");
        setSaving(false);
        return;
      }

      for (const item of validItems) {
        const product = item.product;
        const qty = item.quantity;
        const unitPrice = calcPrice(product, movType, qty, categories, selectedClient);
        const taxRate = product.tax_rate || 0;
        const totalWithoutTax = qty * unitPrice;
        const totalWithTax = totalWithoutTax * (1 + taxRate / 100);
        let newStock = product.stock || 0;

        if (movType === "exit" || movType === "return") {
          if (newStock < qty) {
            toast.error(`Stock insuficiente en "${product.name}": hay ${newStock}, solicitados ${qty}`);
            setSaving(false);
            return;
          }
          newStock -= qty;
        } else if (movType === "entry") {
          newStock += qty;
        } else if (movType === "adjustment") {
          newStock = qty;
        }

        const movResp = await base44.functions.invoke('createMovementSafe', {
          product_id: product.id,
          product_name: product.name,
          type: movType,
          quantity: qty,
          unit_price: unitPrice,
          cost_price: product.purchase_price ?? 0,
          total: totalWithTax,
          stock_after: newStock,
          business_id: businessId,
          reference: pmName,
          reason: clientName,
          paid: movType === "exit" ? isPaid : true,
        });
        if (!movResp.data.success) {
          toast.error(`Error en "${product.name}": ${movResp.data.error}`);
          setSaving(false);
          return;
        }

        const stockResp = await base44.functions.invoke('updateProductStockSafe', {
          product_id: product.id,
          new_stock: newStock,
          business_id: businessId,
        });
        if (!stockResp.data.success) {
          toast.error(`Error actualizando stock de "${product.name}": ${stockResp.data.error}`);
          setSaving(false);
          return;
        }
      }

      toast.success(`${validItems.length} movimiento(s) registrado(s)`);
      onSaved?.({ success: true, count: validItems.length });
    } catch (error) {
      toast.error(`Error al registrar movimiento: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {showCamera && (
        <BarcodeCameraScanner
          onDetected={(code) => {
            assignProductByCode(code);
            setShowCamera(false);
            setTimeout(() => barcodeRef.current?.focus(), 100);
          }}
          onClose={() => {
            setShowCamera(false);
            setTimeout(() => barcodeRef.current?.focus(), 100);
          }}
        />
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col p-0 max-h-[90dvh]">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b border-border">
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Barcode scanner */}
          <div className="space-y-2">
            <Label className="text-foreground mb-1.5 block">Escanear producto</Label>
            <div className="flex gap-2">
              <Input
                ref={barcodeRef}
                placeholder="🔫 Escanee código de barras o SKU..."
                value={barcodeInput}
                onChange={(e) => {
                  setBarcodeInput(e.target.value);
                  setBarcodeNotFound(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleBarcodeSearch()}
                className={`flex-1 ${barcodeNotFound ? "border-red-400" : ""}`}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCamera(true)}
                title="Escanear con cámara"
              >
                <ScanLine className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleBarcodeSearch}
                title="Buscar código escrito"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {barcodeNotFound && (
              <p className="text-xs text-red-500 pl-1">Código no encontrado.</p>
            )}
          </div>

          {/* Tipo */}
          <div>
            <Label className="text-foreground mb-1.5 block">Tipo de movimiento *</Label>
            <MobileSelect
              value={movType}
              onValueChange={(val) => { setMovType(val); setClientId(""); }}
              placeholder="Tipo"
              options={ALL_TYPES.filter(t => t.value !== "adjustment" || isAdmin).map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>

          {movType === "adjustment" && (
            <div className="bg-amber-100/40 border border-amber-400 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-200">
              ⚠️ El <strong>ajuste</strong> establece el stock final de forma absoluta.
            </div>
          )}

          {/* OB3: Lista de productos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Productos *</Label>
              <Button variant="outline" size="sm" onClick={addItem} type="button">
                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar producto
              </Button>
            </div>

            {items.map((item, idx) => {
              const unitPrice = calcPrice(item.product, movType, item.quantity, categories, selectedClient);
              return (
                <div key={idx} className="border border-border rounded-xl p-3 space-y-2 bg-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Producto {idx + 1}</span>
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(idx)} type="button">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    )}
                  </div>
                  <ProductSearchInput
                    products={products}
                    selectedProduct={item.product}
                    onSelect={(pid) => {
                      const found = products.find(p => p.id === pid) || null;
                      updateItem(idx, "product", found);
                    }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        {movType === "adjustment" ? "Stock final *" : "Cantidad *"}
                      </Label>
                      <Input
                        type="number" min={0}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Precio</Label>
                      <div className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm items-center text-muted-foreground">
                        ${unitPrice.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  {item.product && (
                    <p className="text-xs text-right text-muted-foreground">
                      Subtotal: <span className="font-semibold text-foreground">
                        ${(item.quantity * unitPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total general */}
          <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-300 dark:border-indigo-700 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total</p>
            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
              ${grandTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Forma de pago — oculto en ajuste */}
          {!isAdjustment && (
            <div>
              <Label className="text-foreground mb-1.5 block">{movType === "return" ? "Método de reembolso *" : "Forma de pago *"}</Label>
              <SearchableSelect
                value={paymentMethodId}
                onValueChange={setPaymentMethodId}
                placeholder={movType === "return" ? "Seleccionar método de reembolso" : "Seleccionar forma de pago"}
                options={paymentMethods.map((pm) => ({ value: pm.id, label: pm.name }))}
              />
              {paymentMethods.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No hay formas de pago. Agrégalas en Configuración → Pagos.</p>
              )}
            </div>
          )}

          {/* Cliente / Proveedor según tipo — oculto en ajuste */}
          {!isAdjustment && (
            <div>
              <Label className="text-foreground mb-1.5 block">
                {movType === "entry" ? "Proveedor *" : "Cliente *"}
              </Label>
              <SearchableSelect
                value={clientId}
                onValueChange={setClientId}
                placeholder={movType === "entry" ? "Seleccionar proveedor" : "Seleccionar cliente"}
                options={movType === "entry"
                  ? suppliers.map((s) => ({ value: s.id, label: s.name }))
                  : clients.map((c) => ({ value: c.id, label: c.name, searchLabel: c.business_name || c.name }))
                }
              />
            </div>
          )}

          {/* Confirmación de pago — solo para salidas */}
          {movType === "exit" && (
            <button
              type="button"
              onClick={() => setIsPaid(!isPaid)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                isPaid
                  ? "bg-emerald-50 border-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-600"
                  : "bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-600"
              }`}
            >
              <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${isPaid ? "text-emerald-600" : "text-orange-400"}`} />
              <div className="text-left">
                <p className={`text-sm font-semibold ${isPaid ? "text-emerald-800 dark:text-emerald-300" : "text-orange-800 dark:text-orange-300"}`}>
                  {isPaid ? "Pago recibido ✓" : "Pago pendiente"}
                </p>
                <p className={`text-xs ${isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                  {isPaid ? "El cliente ya pagó este movimiento" : "Toca para confirmar que el pago ya se recibió"}
                </p>
              </div>
            </button>
          )}
        </div>

        {/* OB4: resumen de qué falta */}
        {(!items.some(i => i.product) || (needsParty && (!paymentMethodId || !clientId))) && (
          <div className="px-6 pb-2 shrink-0 space-y-0.5">
            {!items.some(i => i.product) && <p className="text-xs text-red-500">• Selecciona al menos un producto</p>}
            {needsParty && !paymentMethodId && paymentMethods.length > 0 && <p className="text-xs text-red-500">• Selecciona {movType === "return" ? "el método de reembolso" : "la forma de pago"}</p>}
            {needsParty && !clientId && <p className="text-xs text-red-500">• Selecciona el {movType === "entry" ? "proveedor" : "cliente"}</p>}
          </div>
        )}

        <div className="flex justify-end gap-3 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} {...createButtonProps('cancel')}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-indigo-600 hover:bg-indigo-700"
            {...createButtonProps('save')}
          >
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}