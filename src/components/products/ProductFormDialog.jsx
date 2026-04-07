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
import { Save, X, ScanBarcode, Wand2, Camera, Plus, Barcode, Loader2 } from "lucide-react";
import BarcodeCameraScanner from "./BarcodeCameraScanner";
import { useBusinessContext } from "@/components/BusinessContext";
import { createButtonProps } from "@/lib/a11y";
import { toast } from "sonner";

const UNITS = ["pieza", "kg", "litro", "metro", "caja", "paquete"];

export default function ProductFormDialog({ open, onOpenChange, product, onSaved }) {
  const { businessId, user } = useBusinessContext();
  const isAlmacenista = user?.role === "almacenista";
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    name: "", sku: "", barcode: "", description: "",
    category: "", supplier: "", purchase_price: 0,
    retail_sale_price: 0, wholesale_sale_price: "",
    stock: 0, min_stock: 5, unit: "pieza",
    status: "active", tax_rate: 16,
  });
  const [saving, setSaving] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showNewCatDialog, setShowNewCatDialog] = useState(false);
  const [showNewSupDialog, setShowNewSupDialog] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newSupName, setNewSupName] = useState("");
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const lastKeystroke = useRef(Date.now());
  const barcodeBuffer = useRef("");
  const scannerTimeoutRef = useRef(null);

  useEffect(() => {
    if (!businessId) return;
    Promise.all([
      base44.entities.Category.filter({ business_id: businessId }),
      base44.entities.Supplier.filter({ business_id: businessId }),
    ]).then(([cats, sups]) => {
      setCategories(cats);
      setSuppliers(sups);
    });
  }, [businessId]);

  useEffect(() => {
    if (!open) {
      setShowCamera(false);
      setScanning(false);
      barcodeBuffer.current = "";
      if (scannerTimeoutRef.current) clearTimeout(scannerTimeoutRef.current);
      return;
    }
    if (product) {
      setForm({
        name: product.name || "",
        sku: product.sku || "",
        barcode: product.barcode || "",
        description: product.description || "",
        category: product.category || "",
        supplier: product.supplier || "",
        purchase_price: product.purchase_price || 0,
        retail_sale_price: product.retail_sale_price ?? product.sale_price ?? 0,
        wholesale_sale_price: product.wholesale_sale_price ?? "",
        stock: product.stock || 0,
        min_stock: product.min_stock || 5,
        unit: product.unit || "pieza",
        status: product.status || "active",
        tax_rate: product.tax_rate ?? 16,
      });
    } else {
      setForm({
        name: "", sku: "", barcode: "", description: "",
        category: "", supplier: "", purchase_price: 0,
        retail_sale_price: 0, wholesale_sale_price: "",
        stock: 0, min_stock: 5, unit: "pieza",
        status: "active", tax_rate: 16,
      });
    }
  }, [product, open]);

  const generateSKU = async () => {
    const selectedCategory = categories.find(c => c.id === form.category);
    const prefix = selectedCategory
      ? selectedCategory.name.replace(/\s+/g, "").substring(0, 3).toUpperCase()
      : "PRD";
    const products = await base44.entities.Product.filter({ business_id: businessId });
    const existing = products
      .map(p => p.sku)
      .filter(s => s && s.startsWith(prefix + "-"))
      .map(s => parseInt(s.split("-")[1], 10))
      .filter(n => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    const sku = `${prefix}-${String(next).padStart(4, "0")}`;
    updateField("sku", sku);
  };

  const handleBarcodeKeyDown = (e) => {
    const now = Date.now();
    if (now - lastKeystroke.current < 50) {
      setScanning(true);
      if (scannerTimeoutRef.current) clearTimeout(scannerTimeoutRef.current);
      scannerTimeoutRef.current = setTimeout(() => {
        setScanning(false);
        barcodeBuffer.current = "";
      }, 300);
    } else {
      setScanning(false);
    }
    lastKeystroke.current = now;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        retail_sale_price: Number(form.retail_sale_price) || 0,
        wholesale_sale_price: form.wholesale_sale_price !== "" ? Number(form.wholesale_sale_price) : undefined,
      };

      let response;
      
      if (product) {
        response = await base44.functions.invoke('updateProductSafe', {
          product_id: product.id,
          updates: payload
        });
      } else {
        response = await base44.functions.invoke('createProductSafe', { 
          ...payload, 
          business_id: businessId 
        });
      }

      if (response.data.success === false) {
        toast.error(`Error: ${response.data.error || 'No se pudo guardar'}`);
        return;
      }

      // Crear movimiento inicial si es nuevo producto con stock
      if (!product && response.data.product && form.stock > 0) {
        await base44.entities.Movement.create({
          product_id: response.data.product.id,
          product_name: form.name,
          type: "entry",
          quantity: form.stock,
          unit_price: form.purchase_price || 0,
          total: form.stock * (form.purchase_price || 0),
          reason: "Stock inicial",
          reference: "Stock inicial",
          stock_after: form.stock,
          business_id: businessId,
        });
      }

      toast.success(product ? "✓ Producto actualizado" : "✓ Producto creado");
      onOpenChange(false);
      setTimeout(() => onSaved({ _reconcile: true }), 300);
    } catch (error) {
      console.error("Save error:", error);
      toast.error(`Error: ${error.message || 'No se pudo guardar el producto'}`);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const response = await base44.functions.invoke('createCategorySafe', { name: newCatName.trim(), color: "#6366f1", business_id: businessId });
    if (!response.data.success) { toast.error(`Error: ${response.data.error}`); return; }
    const cats = await base44.entities.Category.filter({ business_id: businessId });
    setCategories(cats);
    updateField("category", response.data.category.id);
    setNewCatName("");
    setShowNewCatDialog(false);
  };

  const handleCreateSupplier = async () => {
    if (!newSupName.trim()) return;
    const response = await base44.functions.invoke('createSupplierSafe', { name: newSupName.trim(), business_id: businessId });
    if (!response.data.success) { toast.error(`Error: ${response.data.error}`); return; }
    const sups = await base44.entities.Supplier.filter({ business_id: businessId });
    setSuppliers(sups);
    updateField("supplier", response.data.supplier.id);
    setNewSupName("");
    setShowNewSupDialog(false);
  };

  const handleGenerateBarcodeInForm = async () => {
    if (!product?.id) {
      // Nuevo producto: generar localmente
      function calcEAN13(code) {
        let sum = 0;
        for (let i = 0; i < code.length; i++) {
          sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
        }
        return ((10 - (sum % 10)) % 10).toString();
      }
      const rand = Math.floor(Math.random() * 9999999999).toString().padStart(9, "0");
      const base = "290" + rand;
      updateField("barcode", base + calcEAN13(base));
      return;
    }
    setGeneratingBarcode(true);
    try {
      const response = await base44.functions.invoke('generateBarcodeSafe', { product_id: product.id });
      if (response.data?.success) {
        updateField("barcode", response.data.barcode);
        toast.success(`Código generado: ${response.data.barcode}`);
      } else {
        toast.error(response.data?.error || 'No se pudo generar el código');
      }
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const canSave = form.name && (Number(form.retail_sale_price) >= 0) && form.name.trim();

  return (
    <React.Fragment>
    {showCamera && (
      <BarcodeCameraScanner
        onDetected={(code) => { updateField("barcode", code); setShowCamera(false); }}
        onClose={() => setShowCamera(false)}
      />
    )}
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
          <DialogTitle>{product ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
          <div className="md:col-span-2">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Nombre del producto" />
          </div>
          <div>
            <Label>SKU</Label>
            <div className="flex gap-2">
              <Input value={form.sku} onChange={(e) => updateField("sku", e.target.value)} placeholder="Código SKU" />
              <Button type="button" variant="outline" size="icon" onClick={generateSKU} title="Generar SKU automático">
                <Wand2 className="h-4 w-4 text-indigo-500" />
              </Button>
            </div>
          </div>
          <div>
            <Label>Código de barras</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={form.barcode}
                  onChange={(e) => updateField("barcode", e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  placeholder={isMobile ? "Toca el ícono para escanear" : "Escanee con pistola o ingrese"}
                  className={scanning ? "border-emerald-400 ring-1 ring-emerald-300 pr-8" : "pr-8"}
                />
                <ScanBarcode className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${scanning ? "text-emerald-500 animate-pulse" : "text-slate-300"}`} />
              </div>
              {!form.barcode && (
                <Button type="button" variant="outline" size="icon" onClick={handleGenerateBarcodeInForm} disabled={generatingBarcode} title="Generar código automático">
                  {generatingBarcode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Barcode className="h-4 w-4 text-indigo-500" />}
                </Button>
              )}
              <Button type="button" variant={isMobile ? "default" : "outline"} size="icon" onClick={() => setShowCamera(true)} title="Escanear con cámara" className={isMobile ? "bg-indigo-600 hover:bg-indigo-700" : ""}>
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label>Categoría</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <MobileSelect value={form.category} onValueChange={(v) => updateField("category", v)} placeholder="Seleccionar categoría" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => { setNewCatName(""); setShowNewCatDialog(true); }} title="Nueva categoría">
                <Plus className="h-4 w-4 text-indigo-500" />
              </Button>
            </div>
          </div>
          <div>
            <Label>Proveedor</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <MobileSelect value={form.supplier} onValueChange={(v) => updateField("supplier", v)} placeholder="Seleccionar proveedor" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => { setNewSupName(""); setShowNewSupDialog(true); }} title="Nuevo proveedor">
                <Plus className="h-4 w-4 text-indigo-500" />
              </Button>
            </div>
          </div>

          {/* PRICING SECTION */}
          <div>
            <Label>Precio de compra</Label>
            <Input type="number" min={0} step="0.01" value={form.purchase_price === 0 ? "" : form.purchase_price} placeholder="0.00" onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateField("purchase_price", isNaN(val) ? 0 : Math.max(0, val));
            }} />
          </div>
          <div>
            <Label>Precio menudeo *</Label>
            <Input type="number" min={0} step="0.01" value={form.retail_sale_price === 0 ? "" : form.retail_sale_price} placeholder="0.00" onChange={(e) => {
              const val = parseFloat(e.target.value);
              updateField("retail_sale_price", isNaN(val) ? 0 : Math.max(0, val));
            }} />
            {form.purchase_price > 0 && form.retail_sale_price > 0 && form.retail_sale_price <= form.purchase_price && (
              <p className="text-xs text-amber-600 mt-1">⚠️ El precio menudeo es menor o igual al costo.</p>
            )}
          </div>
          <div>
            <Label>Precio mayoreo</Label>
            <Input type="number" min={0} step="0.01" value={form.wholesale_sale_price} placeholder="Opcional" onChange={(e) => {
              const val = e.target.value;
              if (val === "") { updateField("wholesale_sale_price", ""); return; }
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 0) updateField("wholesale_sale_price", num);
            }} />
            <p className="text-xs text-muted-foreground mt-1">La cantidad mínima para mayoreo se configura en la Categoría</p>
          </div>

          <div>
            <Label className="text-foreground mb-1.5 block">Stock actual</Label>
            <Input type="number" min={0} value={form.stock === 0 ? "" : form.stock} placeholder="0" onChange={(e) => updateField("stock", e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} disabled={!!product && isAlmacenista} />
            {!!product && isAlmacenista && <p className="text-xs text-muted-foreground mt-1">Usa Movimientos para ajustar el stock.</p>}
          </div>
          <div>
            <Label className="text-foreground mb-1.5 block">Stock mínimo</Label>
            <Input type="number" min={0} value={form.min_stock === 0 ? "" : form.min_stock} placeholder="0" onChange={(e) => updateField("min_stock", e.target.value === "" ? 0 : parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-foreground mb-1.5 block">Unidad</Label>
            <MobileSelect value={form.unit} onValueChange={(v) => updateField("unit", v)} placeholder="Unidad" options={UNITS.map((u) => ({ value: u, label: u }))} />
          </div>
          <div>
            <Label className="text-foreground mb-1.5 block">IVA del producto</Label>
            <MobileSelect
              value={String(form.tax_rate ?? 16)}
              onValueChange={(v) => updateField("tax_rate", Number(v))}
              placeholder="IVA"
              options={[
                { value: "16", label: "16% (con IVA)" },
                { value: "0", label: "0% (sin IVA / exento)" },
              ]}
            />
          </div>
          <div>
            <Label className="text-foreground mb-1.5 block">Estado</Label>
            <MobileSelect value={form.status} onValueChange={(v) => updateField("status", v)} placeholder="Estado" options={[{ value: "active", label: "Activo" }, { value: "inactive", label: "Inactivo" }]} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-foreground mb-1.5 block">Descripción</Label>
            <Textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Descripción..." rows={3} />
          </div>
        </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0 bg-card">
          <Button variant="outline" onClick={() => onOpenChange(false)} {...createButtonProps('cancel')}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving} className="bg-indigo-600 hover:bg-indigo-700" {...createButtonProps('save')}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={showNewCatDialog} onOpenChange={setShowNewCatDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nueva Categoría</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-foreground mb-1.5 block">Nombre *</Label>
            <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Ej: Electrónica" autoFocus onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewCatDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateCategory} disabled={!newCatName.trim()} className="bg-indigo-600 hover:bg-indigo-700">Crear</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={showNewSupDialog} onOpenChange={setShowNewSupDialog}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nuevo Proveedor</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-foreground mb-1.5 block">Nombre *</Label>
            <Input value={newSupName} onChange={(e) => setNewSupName(e.target.value)} placeholder="Ej: Distribuidora ABC" autoFocus onKeyDown={(e) => e.key === "Enter" && handleCreateSupplier()} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewSupDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateSupplier} disabled={!newSupName.trim()} className="bg-indigo-600 hover:bg-indigo-700">Crear</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </React.Fragment>
  );
}