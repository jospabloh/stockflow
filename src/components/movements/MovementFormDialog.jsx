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
import { Save, ScanLine } from "lucide-react";
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

export default function MovementFormDialog({ open, onOpenChange, onSaved }) {
  const { businessId } = useBusinessContext();
  const barcodeRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [barcodeNotFound, setBarcodeNotFound] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    type: "exit",
    quantity: 1,
    reason: "",
    reference: "",
  });
  const [barcodeInput, setBarcodeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [clients, setClients] = useState([]);

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
      setForm({ product_id: "", type: "exit", quantity: 1, reason: "", reference: "", payment_method: "", client_id: "" });
      setSelectedProduct(null);
      setBarcodeInput("");
      setBarcodeNotFound(false);
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  }, [open, businessId]);

  // Calcula el precio unitario según tipo y mayoreo
  const computedUnitPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    if (form.type === "entry") {
      return selectedProduct.purchase_price ?? 0;
    }
    // Para exit/return/adjustment: aplicar lógica de mayoreo por categoría
    const category = categories.find(c => c.id === selectedProduct.category);
    const { price } = calculatePrice({
      product: selectedProduct,
      client: null,
      quantity: form.quantity,
      category,
      categoryQty: form.quantity,
    });
    return price;
  }, [selectedProduct, form.type, form.quantity, categories]);

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;
    const found = products.find(
      (p) => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim()
    );
    if (found) {
      setBarcodeNotFound(false);
      setSelectedProduct(found);
      setForm((prev) => ({ ...prev, product_id: found.id }));
      setBarcodeInput("");
    } else {
      setBarcodeNotFound(true);
    }
  };

  const handleProductSelect = (productId) => {
    if (!productId) {
      setSelectedProduct(null);
      setForm((prev) => ({ ...prev, product_id: "" }));
      return;
    }
    const found = products.find((p) => p.id === productId);
    setSelectedProduct(found || null);
    setForm((prev) => ({ ...prev, product_id: productId }));
  };

  const handleSave = async () => {
    setSaving(true);
    const product = selectedProduct;

    // VALIDACIÓN COMPLETA BACKEND de cantidad
    if (!Number.isInteger(form.quantity) || form.quantity < 0 || isNaN(form.quantity)) {
      toast.error("Cantidad no válida. Debe ser un número entero positivo.");
      setSaving(false);
      return;
    }

    // Para entrada, return, y adjustment, cantidad debe ser > 0. Para exit también.
    if (form.quantity === 0) {
      toast.error("Cantidad debe ser mayor a 0.");
      setSaving(false);
      return;
    }

    // Validación específica por tipo
    let newStock = product.stock || 0;

    if (form.type === "exit" || form.type === "return") {
      // Salidas y devoluciones decrementan
      if (newStock < form.quantity) {
        toast.error(`Stock insuficiente. Solo hay ${newStock} unidad(es) disponibles de "${product.name}".`);
        setSaving(false);
        return;
      }
      newStock -= form.quantity;
    } else if (form.type === "entry") {
      // Entradas incrementan
      newStock += form.quantity;
    } else if (form.type === "adjustment") {
      // Ajuste REEMPLAZA (no suma)
      newStock = form.quantity;
    }

    // Validar que stock final no sea negativo (extra safety para adjustment)
    if (newStock < 0) {
      toast.error("La operación resultaría en stock negativo. No permitido.");
      setSaving(false);
      return;
    }

    try {
      // SECURITY: Validate product belongs to same business via backend
      const validResult = await base44.functions.invoke('validateBusinessOwnership', {
        entity_name: 'Product',
        record_id: product.id,
        operation: 'update',
      });
      if (!validResult.data?.valid) {
        toast.error("⚠️ No tienes permiso para modificar este producto");
        return;
      }

      // Resolver nombre de forma de pago para desnormalizar
      const pmName = paymentMethods.find(p => p.id === form.payment_method)?.name || form.payment_method || "";
      const clientName = clients.find(c => c.id === form.client_id)?.name || "";

      const response = await base44.functions.invoke('createMovementSafe', {
        ...form,
        unit_price: computedUnitPrice,
        product_name: product.name,
        total: form.quantity * computedUnitPrice,
        stock_after: newStock,
        business_id: businessId,
        reference: pmName,
        reason: clientName,
      });
      if (!response.data.success) {
        toast.error(`Error: ${response.data.error}`);
        return;
      }

      // CRITICAL: Use dedicated stock update function (validates ownership server-side)
      const updateResponse = await base44.functions.invoke('updateProductStockSafe', {
        product_id: product.id,
        new_stock: newStock,
        business_id: businessId,
      });
      if (!updateResponse.data.success) {
        toast.error(`Error actualizando stock: ${updateResponse.data.error}`);
        return;
      }

      // Solo cerrar y notificar DESPUÉS de éxito
      onSaved({ productId: product.id, newStock, _optimistic: true });
      onOpenChange(false);
      onSaved({ _reconcile: true });
    } catch (error) {
      toast.error(`Error al registrar movimiento: ${error.message}`);
      // No cerrar diálogo si hay error
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[calc(100vh-80px)] p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
          {/* Barcode scanner input */}
          <div className="space-y-2">
            <Label className="text-foreground mb-1.5 block">Escanear producto</Label>
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

          {form.type === "adjustment" && (
            <div className="bg-amber-100/40 border border-amber-400 rounded-xl p-3 text-xs text-amber-100 dark:text-amber-200">
              ⚠️ El <strong>ajuste</strong> establece el stock final de forma absoluta. Ejemplo: si ingresas 10, el stock quedará en 10 unidades.
            </div>
          )}

          <ProductSearchInput
            products={products}
            selectedProduct={selectedProduct}
            onSelect={handleProductSelect}
          />

          <div>
            <Label className="text-foreground mb-1.5 block">Tipo de movimiento *</Label>
            <MobileSelect
              value={form.type}
              onValueChange={(v) => updateField("type", v)}
              placeholder="Tipo"
              options={TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-foreground mb-1.5 block">{form.type === "adjustment" ? "Stock absoluto nuevo (valor final) *" : "Cantidad *"}</Label>
              <Input type="number" min={0} value={form.quantity} onChange={(e) => updateField("quantity", parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-foreground mb-1.5 block">Precio unitario</Label>
              <div className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm items-center text-muted-foreground">
                ${computedUnitPrice.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Precio del catálogo</p>
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-300 dark:border-indigo-700 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total</p>
            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
              ${(form.quantity * computedUnitPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div>
            <Label className="text-foreground mb-1.5 block">Forma de pago</Label>
            <MobileSelect
              value={form.payment_method}
              onValueChange={(v) => updateField("payment_method", v)}
              placeholder="Seleccionar forma de pago"
              options={paymentMethods.map((pm) => ({ value: pm.id, label: pm.name }))}
            />
            {paymentMethods.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No hay formas de pago configuradas. Agrégalas en Configuración → Pagos.</p>
            )}
          </div>
          <div>
            <Label className="text-foreground mb-1.5 block">Cliente</Label>
            <MobileSelect
              value={form.client_id}
              onValueChange={(v) => updateField("client_id", v)}
              placeholder="Seleccionar cliente (opcional)"
              options={clients.map((c) => ({ value: c.id, label: c.name + (c.business_name ? ` — ${c.business_name}` : "") }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} {...createButtonProps('cancel')}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.product_id || form.quantity <= 0 || saving} className="bg-indigo-600 hover:bg-indigo-700" {...createButtonProps('save')}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}