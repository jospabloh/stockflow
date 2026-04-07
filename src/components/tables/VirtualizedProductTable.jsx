import React, { useState } from "react";
import { FixedSizeList as List } from "react-window";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, AlertTriangle, Barcode, Loader2 } from "lucide-react";
import { createButtonProps } from "@/lib/a11y";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const ITEM_HEIGHT = 60;
const HEADER_HEIGHT = 52;

export default function VirtualizedProductTable({ products, categories, onEdit, onDelete, isAdmin, onBarcodeGenerated }) {
  const [generatingId, setGeneratingId] = useState(null);
  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || "—";

  const handleGenerateBarcode = async (product) => {
    setGeneratingId(product.id);
    try {
      const response = await base44.functions.invoke('generateBarcodeSafe', { product_id: product.id });
      if (response.data?.success) {
        toast.success(`Código generado: ${response.data.barcode}`);
        onBarcodeGenerated?.();
      } else {
        toast.error(response.data?.error || 'No se pudo generar el código');
      }
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setGeneratingId(null);
    }
  };

  const ProductRow = ({ index, style }) => {
    const product = products[index];
    const minStock = product.min_stock ?? 5;
    const isOutOfStock = product.stock <= 0;
    const isBelowMin = !isOutOfStock && product.stock < minStock;
    const isAtMin = !isOutOfStock && product.stock === minStock;

    return (
      <div style={style} className="flex items-center border-b border-border hover:bg-muted/40 transition-colors px-4">
        <div className="flex-1 py-2 min-w-0">
          <p className="font-medium text-foreground truncate">{product.name}</p>
          {product.barcode && <p className="text-xs text-muted-foreground">{product.barcode}</p>}
        </div>
        <div className="w-20 text-muted-foreground text-xs truncate">{product.sku || "—"}</div>
        <div className="w-20 text-muted-foreground text-xs truncate">{getCategoryName(product.category)}</div>
        {isAdmin && (
          <div className="w-24 text-right text-muted-foreground text-xs">
            ${product.purchase_price?.toLocaleString("es-MX", { minimumFractionDigits: 2 }) || "—"}
          </div>
        )}
        <div className="w-24 text-right font-semibold text-foreground text-xs">
          ${(product.retail_sale_price ?? product.sale_price ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
        </div>
        <div className="w-32 text-right">
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              {(isOutOfStock || isBelowMin || isAtMin) && (
                <AlertTriangle className={`h-3.5 w-3.5 ${isOutOfStock ? "text-red-500" : "text-amber-500"}`} />
              )}
              <span className={`font-semibold text-xs ${isOutOfStock ? "text-red-600" : (isBelowMin || isAtMin) ? "text-amber-600" : "text-foreground"}`}>
                {product.stock} {product.unit}
              </span>
            </div>
            {isOutOfStock && <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 rounded">AGOTADO</span>}
            {isBelowMin && <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 rounded">CRÍTICO</span>}
            {isAtMin && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">MÍNIMO</span>}
          </div>
        </div>
        <div className="w-16 text-center">
          <Badge variant={product.status === "active" ? "default" : "secondary"} className={`text-xs ${product.status === "active" ? "bg-emerald-100 text-emerald-700 border-0" : ""}`}>
            {product.status === "active" ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        <div className="w-24 text-center flex items-center justify-center gap-1">
          {!product.barcode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleGenerateBarcode(product)}
              title="Generar código de barras"
              disabled={generatingId === product.id}
            >
              {generatingId === product.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                : <Barcode className="h-3.5 w-3.5 text-slate-400" />}
            </Button>
          )}
          {isAdmin && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7" 
                onClick={() => onEdit(product)}
                {...createButtonProps('edit')}
              >
                <Pencil className="h-3.5 w-3.5 text-slate-400" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7" 
                onClick={() => onDelete(product)}
                {...createButtonProps('delete')}
              >
                <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (products.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center text-muted-foreground">
        No hay productos registrados
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border">
      {/* Header */}
      <div className="flex items-center px-4 py-3 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground sticky top-0 z-10">
        <div className="flex-1 min-w-0">Producto</div>
        <div className="w-20">SKU</div>
        <div className="w-20">Categoría</div>
        {isAdmin && <div className="w-24 text-right">Precio Compra</div>}
        <div className="w-24 text-right">Precio Menudeo</div>
        <div className="w-32 text-right">Stock</div>
        <div className="w-16 text-center">Estado</div>
        <div className="w-24 text-center">Acciones</div>
      </div>

      {/* Virtualized List */}
      <List height={500} itemCount={products.length} itemSize={ITEM_HEIGHT} width="100%">
        {ProductRow}
      </List>
    </div>
  );
}