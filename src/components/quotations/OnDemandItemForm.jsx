import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SelectWrapper from "@/components/wrappers/SelectWrapper";
import { Plus } from "lucide-react";
import { useBusinessContext } from "@/components/BusinessContext";

const UNITS = ["pieza", "kg", "litro", "metro", "caja", "paquete"];

const empty = () => ({
  product_name: "",
  product_description: "",
  quantity: 1,
  unit: "pieza",
  unit_price: "",
  tax_rate: 16,
  supplier_id: "",
});

export default function OnDemandItemForm({ onAdd }) {
  const { businessId } = useBusinessContext();
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(empty());
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (businessId) {
      base44.entities.Supplier.filter({ business_id: businessId })
        .then(setSuppliers)
        .catch(() => {});
    }
  }, [businessId]);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const computedTotal = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  const validate = () => {
    const e = {};
    if (!form.product_name.trim()) e.product_name = "Requerido";
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = "Debe ser > 0";
    if (!form.unit_price || Number(form.unit_price) <= 0) e.unit_price = "Debe ser > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = () => {
    if (!validate()) return;
    const supplier = suppliers.find(s => s.id === form.supplier_id);
    onAdd({
      product_id: null,
      is_on_demand: true,
      on_demand_status: "pending",
      product_name: form.product_name.trim(),
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
    setErrors({});
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Producto bajo pedido</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Nombre del producto <span className="text-red-500">*</span></Label>
          <Input
            value={form.product_name}
            onChange={e => set("product_name", e.target.value)}
            placeholder="Nombre del producto"
            className={errors.product_name ? "border-red-400" : ""}
          />
          {errors.product_name && <p className="text-[10px] text-red-500 mt-0.5">{errors.product_name}</p>}
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
        <Label className="text-xs mb-1 block">Descripción / especificaciones</Label>
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