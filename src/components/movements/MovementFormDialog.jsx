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
import { Save, ScanLine, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBusinessContext } from "@/components/BusinessContext";
import { createButtonProps } from "@/lib/a11y";
import { calculatePrice } from "@/lib/pricingEngine";
import ProductSearchInput from "./ProductSearchInput";

const TYPES = [
  { value: "entry", label: "Entrada (Compra)" },
  { value: "exit", label: "Salida (Venta)" },
  { value: "return", label: "Devolución" },
  { value: "adjustment", label: "Ajuste" },
];

// Calcula precio para un producto según tipo y categorías
function calcPrice(product, type, quantity, categories) {
  if (!product) return 0;
  if (type === "entry") return product.purchase_price ?? 0;
  const category = categories.find(c => c.id === product.category);
  const { price } = calculatePrice({
    product, client: null, quantity, category, categoryQty: quantity,
  });
  return price;
}

export default function MovementFormDialog({ open, onOpenChange, onSaved }) {
  const { businessId } = useBusinessContext();
  const barcodeRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [clients, setClients] = useState([]);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Campos comunes del movimiento
  const [movType, setMovType] = useState("exit");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [clientId, setClientId] = useState("");

  // OB3: Lista de items (cada uno con producto + cantidad)
  const [items, setItems] = useState([{ product: null, quantity: 1 }]);

  useEffect(() => {
    if (open && businessId) {
      Promise.all([
        base44.entities.Product.filter({ status: "active", business_id: businessId }),
        base44.entities.Category.filter({ business_id: businessId }),
        base44.entities.PaymentMethod.filter({ business_id: businessId, active: true }),
        base44.entities.Client.filter({ business_id: businessId, status: "active" }),
      ]).then(([prods, cats, pms, cls]) => {
        setProducts(prods);
        setCategories(cats);
        setPaymentMethods(pms);
        setClients(cls);
      });
      setMovType("exit");
      setPaymentMethodId("");
      setClientId("");
      setItems([{ product: null, quantity: 1 }]);
      setBarcodeInput("");
      setBarcodeNotFound(false);
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  }, [open, businessId]);

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;
    const found = products.find(
      (p) => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim()
    );
    if (found) {
      setBarcodeNotFound(false);
      // Si el último item no tiene producto, asignarlo ahí; sino agregar nuevo
      setItems(prev => {
        const last = prev[prev.length - 1];
        if (!last.product) {
          return prev.map((item, i) => i === prev.length - 1 ? { ...item, product: found } : item);
        }
        return [...prev, { product: found, quantity: 1 }];
      });
      setBarcodeInput("");
    } else {
      setBarcodeNotFound(true);
    }
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, { product: null, quantity: 1 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  // Total general
  const grandTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const price = calcPrice(item.product, movType, item.quantity, categories);
      return sum + (item.quantity * price);
    }, 0);
  }, [items, movType, categories]);

  const canSave = items.some(i => i.product) && paymentMethodId && clientId && !saving;

  const handleSave = async () => {
    if (!items.some(i => i.product)) {
      toast.error("Selecciona al menos un producto");
      return;
    }
    if (!paymentMethodId) {
      toast.error("⚠️ Selecciona la forma de pago");
      return;
    }
    if (!clientId) {
      toast.error("⚠️ Selecciona el cliente");
      return;
    }

    setSaving(true);
    const pmName = paymentMethods.find(p => p.id === paymentMethodId)?.name || "";
    const clientObj = clients.find(c => c.id === clientId);
    const clientName = clientObj?.business_name || clientObj?.name || "";

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
        const unitPrice = calcPrice(product, movType, qty, categories);
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
          total: qty * unitPrice,
          stock_after: newStock,
          business_id: businessId,
          reference: pmName,
          reason: clientName,
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
      onSaved({ _optimistic: true });
      onOpenChange(false);
      onSaved({ _reconcile: true });
    } catch (error) {
      toast.error(`Error al registrar movimiento: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[calc(100vh-80px)] p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
          {/* Barcode scanner */}
          <div className="space-y-2">
            <Label className="text-foreground mb-1.5 block">Escanear producto</Label>
            <div className="flex gap-2">
              <Input
                ref={barcodeRef}
                placeholder="🔫 Escanee código de barras o SKU..."
                value={barcodeInput}
                onChange={(e) => { setBarcodeInput(e.target.value); setBarcodeNotFound(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleBarcodeSearch()}
                className={`flex-1 ${barcodeNotFound ? "border-red-400" : ""}`}
              />
              <Button variant="outline" onClick={handleBarcodeSearch}>
                <ScanLine className="h-4 w-4" />
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
              onValueChange={setMovType}
              placeholder="Tipo"
              options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
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
              const unitPrice = calcPrice(item.product, movType, item.quantity, categories);
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

          {/* Forma de pago */}
          <div>
            <Label className="text-foreground mb-1.5 block">Forma de pago *</Label>
            <SearchableSelect
              value={paymentMethodId}
              onValueChange={setPaymentMethodId}
              placeholder="Seleccionar forma de pago"
              options={paymentMethods.map((pm) => ({ value: pm.id, label: pm.name }))}
            />
            {paymentMethods.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No hay formas de pago. Agrégalas en Configuración → Pagos.</p>
            )}
          </div>

          {/* Cliente */}
          <div>
            <Label className="text-foreground mb-1.5 block">Cliente *</Label>
            <SearchableSelect
              value={clientId}
              onValueChange={setClientId}
              placeholder="Seleccionar cliente"
              options={clients.map((c) => ({
                value: c.id,
                label: c.name,
                searchLabel: c.business_name || c.name,
              }))}
            />
          </div>
        </div>

        {/* OB4: resumen de qué falta */}
        {(!items.some(i => i.product) || !paymentMethodId || !clientId) && (
          <div className="px-6 pb-2 shrink-0 space-y-0.5">
            {!items.some(i => i.product) && <p className="text-xs text-red-500">• Selecciona al menos un producto</p>}
            {!paymentMethodId && paymentMethods.length > 0 && <p className="text-xs text-red-500">• Selecciona la forma de pago</p>}
            {!clientId && <p className="text-xs text-red-500">• Selecciona el cliente</p>}
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
  );
}