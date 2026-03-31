import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProductSearchInput({ products, selectedProduct, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = query.trim()
    ? products.filter((p) =>
        p.name?.toLowerCase().includes(query.toLowerCase()) ||
        p.sku?.toLowerCase().includes(query.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(query.toLowerCase())
      )
    : products;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (product) => {
    onSelect(product.id);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    onSelect("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Label className="text-foreground mb-1.5 block">Producto *</Label>

      {selectedProduct ? (
        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-md px-3 py-2 text-sm">
          <div>
            <span className="font-semibold text-foreground">{selectedProduct.name}</span>
            <span className="text-muted-foreground ml-2">— Stock: {selectedProduct.stock} {selectedProduct.unit}</span>
          </div>
          <button type="button" onClick={handleClear} className="ml-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nombre, SKU o código..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="pl-9"
            autoComplete="off"
          />
        </div>
      )}

      {open && !selectedProduct && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors"
                )}
              >
                <span className="font-medium text-foreground truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">Stock: {p.stock} {p.unit}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}