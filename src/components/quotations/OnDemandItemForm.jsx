import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SelectWrapper from "@/components/wrappers/SelectWrapper";
import { Plus, Search, X } from "lucide-react";
import { useBusinessContext } from "@/components/BusinessContext";
import { calculatePrice } from "@/lib/pricingEngine";

const UNITS = ["pieza", "kg", "litro", "metro", "caja", "paquete"];

const empty = () => ({
  product_id: null,
  product_name: "",
  product_description: "",
  quantity: 1,
  unit: "pieza",
  unit_price: "",
  tax_rate: 16,
  supplier_id: "",
});

export default function OnDemandItemForm({ onAdd, selectedClient }) {
  const { businessId } = useBusinessContext();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(empty());
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (businessId) {
      base44.entities.Supplier.filter({ business_id: businessId })
        .then(setSuppliers)
        .catch(() => {});
      base44.entities.Product.filter({ business_id: businessId, status: "active" })
        .then(setProducts)
        .catch(() => {});
    }
  }, [businessId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredProducts = search.length >= 1
    ? products.filter(p => {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q);
      }).slice(0, 12)
    : [];

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setSearch(product.name);
    setShowDropdown(false);

    // Pre-fill price using pricing engine if we have a client
    let price = product.retail_sale_price || 0;
    if (selectedClient) {
      const { price: calcPrice } = calculatePrice({
        product,
        client: selectedClient,
        quantity: form.quantity,
        category: null,
        categoryQty: 0,
      });
      price = calcPrice;
    }

    setForm(prev => ({
      ...prev,
      product_id: product.id,
      product_name: product.name,
      product_description: product.description || prev.product_description,
      unit: product.unit || prev.unit,
      tax_rate: product.tax_rate ?? 16,
      unit_price: price,
    }));
    setErrors(prev => ({ ...prev, product_id: undefined }));
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setSearch("");
    setForm(prev => ({ ...prev, product_id: null, product_name: "" }));
  };

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const computedTotal = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  const validate = () => {
    const e = {};
    if (!form.product_id) e.product_id = "Selecciona un producto del catálogo";
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = "Debe ser > 0";
    if (!form.unit_price || Number(form.unit_price) <= 0) e.unit_price = "Debe ser > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = () => {
    if (!validate()) return;
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    onAdd({
      product_id: form.product_id,
      is_on_demand: true,
      on_demand_status: "pending",
      product_name: form.product_name,
      product_description: form.product_description.trim(),
      quantity: Number(form.quantity),
      unit: form.unit,
      unit_price: Number(form.unit_price),
      total: computedTotal,
      tax_rate: Number(form.tax_rate),
      supplier_id: form.supplier_id || null,
      supplier_name: supplier?.name || null,
    });
    setForm(empty());
    setSelectedProduct(null);
    setSearch("");
    setErrors({});
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Producto bajo pedido</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Product search */}
        <div ref={dropdownRef} className="relative">
          <Label className="text-xs mb-1 block">
            Producto del catálogo <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setShowDropdown(true);
                if (!e.target.value) handleClearProduct();
              }}
              onFocus={() => search && setShowDropdown(true)}
              placeholder="Buscar por nombre o SKU..."
              className={`pl-8 pr-8 ${errors.product_id ? "border-red-400" : ""}`}
            />
            {selectedProduct && (
              <button
                type="button"
                onClick={handleClearProduct}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {errors.product_id && <p className="text-[10px] text-red-500 mt-0.5">{errors.product_id}</p>}

          {showDropdown && filteredProducts.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-56 overflow-y-auto">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={() => handleSelectProduct(p)}
                  className="w-full text-left px-3 py-2 hover:bg-orange-50 text-sm border-b border-border/50 last:border-0"
                >
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.sku ? `SKU: ${p.sku} · ` : ""}Stock: {p.stock ?? 0} {p.unit || "pzs"}
                  </p>
                </button>
              ))}
            </div>
          )}

          {selectedProduct && (
            <div className="mt-1 text-[10px] text-orange-700 bg-orange-100 rounded px-2 py-1">
              Stock actual: <strong>{selectedProduct.stock ?? 0}</strong> {selectedProduct.unit || "pzs"}
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs mb-1 block">Proveedor sugerido</Label>
          <SelectWrapper
            value={form.supplier_id}
            onValueChange={v => set("supplier_id", v)}
            placeholder="Sin proveedor"
            options={[
              { value: "", label: "Sin proveedor" },
              ...suppliers.map(s => ({ value: s.id, label: s.name }))
            ]}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs mb-1 block">Descripción / especificaciones adicionales</Label>
        <Textarea
          value={form.product_description}
          onChange={e => set("product_description", e.target.value)}
          placeholder="Especificaciones, medidas, referencia..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Cantidad <span className="text-red-500">*</span></Label>
          <Input
            type="number" min={1}
            value={form.quantity}
            onChange={e => set("quantity", e.target.value)}
            className={errors.quantity ? "border-red-400" : ""}
          />
          {errors.quantity && <p className="text-[10px] text-red-500 mt-0.5">{errors.quantity}</p>}
        </div>

        <div>
          <Label className="text-xs mb-1 block">Unidad</Label>
          <SelectWrapper
            value={form.unit}
            onValueChange={v => set("unit", v)}
            placeholder="Unidad"
            options={UNITS.map(u => ({ value: u, label: u }))}
          />
        </div>

        <div>
          <Label className="text-xs mb-1 block">Precio unitario <span className="text-red-500">*</span></Label>
          <Input
            type="number" min={0} step="0.01"
            value={form.unit_price}
            onChange={e => set("unit_price", e.target.value)}
            className={errors.unit_price ? "border-red-400" : ""}
          />
          {errors.unit_price && <p className="text-[10px] text-red-500 mt-0.5">{errors.unit_price}</p>}
        </div>

        <div>
          <Label className="text-xs mb-1 block">IVA</Label>
          <SelectWrapper
            value={String(form.tax_rate)}
            onValueChange={v => set("tax_rate", Number(v))}
            placeholder="IVA"
            options={[
              { value: "16", label: "IVA 16%" },
              { value: "0", label: "Exento (0%)" },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-orange-700 font-medium">
          Total: <strong>${computedTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>
        </span>
        <Button type="button" size="sm" onClick={handleAdd} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-4 w-4 mr-1" /> Agregar bajo pedido
        </Button>
      </div>
    </div>
  );
}