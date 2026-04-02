import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, AlertTriangle, Barcode, Loader2 } from "lucide-react";
import { createButtonProps } from "@/lib/a11y";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import VirtualizedProductTable from "@/components/tables/VirtualizedProductTable";

export default function ProductTable({ products, categories, onEdit, onDelete, isAdmin, onBarcodeGenerated }) {
  const navigate = useNavigate();
  const [generatingId, setGeneratingId] = useState(null);

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
  // Use virtualized table for desktop, card layout for mobile
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  if (!isMobile && products.length > 20) {
    return <VirtualizedProductTable products={products} categories={categories} onEdit={onEdit} onDelete={onDelete} isAdmin={isAdmin} onBarcodeGenerated={onBarcodeGenerated} />;
  }
  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || "—";

  const ProductRow = ({ product }) => {
    const minStock = product.min_stock ?? 5;
    const isOutOfStock = product.stock <= 0;
    const isBelowMin = !isOutOfStock && product.stock < minStock;
    const isAtMin = !isOutOfStock && product.stock === minStock;
    return (
       <TableRow key={product.id} className="hover:bg-muted/40 transition-colors" role="row">
        <TableCell>
          <div>
            <p className="font-medium text-foreground">{product.name}</p>
            {product.barcode && <p className="text-xs text-muted-foreground">{product.barcode}</p>}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{product.sku || "—"}</TableCell>
        <TableCell className="text-muted-foreground">{getCategoryName(product.category)}</TableCell>
        {isAdmin && (
          <TableCell className="text-right text-muted-foreground">
            ${product.purchase_price?.toLocaleString("es-MX", { minimumFractionDigits: 2 }) || "—"}
          </TableCell>
        )}
        <TableCell className="text-right font-semibold text-foreground">
          ${(product.retail_sale_price ?? product.sale_price ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              {(isOutOfStock || isBelowMin || isAtMin) && <AlertTriangle className={`h-4 w-4 ${isOutOfStock ? "text-red-500" : "text-amber-500"}`} />}
              <span className={`font-semibold ${isOutOfStock ? "text-red-600" : (isBelowMin || isAtMin) ? "text-amber-600" : "text-foreground"}`}>
                {product.stock} {product.unit}
              </span>
            </div>
            {isOutOfStock && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded">AGOTADO</span>}
            {isBelowMin && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 rounded">STOCK CRÍTICO</span>}
            {isAtMin && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">STOCK MÍNIMO</span>}
          </div>
        </TableCell>
        <TableCell className="text-center">
          <Badge variant={product.status === "active" ? "default" : "secondary"} className={product.status === "active" ? "bg-emerald-100 text-emerald-700 border-0" : ""}>
            {product.status === "active" ? "Activo" : "Inactivo"}
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1">
            {!product.barcode && (
              <Button 
                 variant="ghost" 
                 size="icon" 
                 className="h-8 w-8" 
                 onClick={() => handleGenerateBarcode(product)}
                 title="Generar código de barras"
                 disabled={generatingId === product.id}
               >
                 {generatingId === product.id
                   ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                   : <Barcode className="h-4 w-4 text-slate-400" />}
               </Button>
            )}
            {isAdmin && (
              <>
                <Button 
                   variant="ghost" 
                   size="icon" 
                   className="h-8 w-8" 
                   onClick={() => onEdit(product)}
                   {...createButtonProps('edit')}
                 >
                   <Pencil className="h-4 w-4 text-slate-400" />
                 </Button>
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="h-8 w-8" 
                   onClick={() => onDelete(product)}
                   {...createButtonProps('delete')}
                 >
                   <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                 </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const ProductCard = ({ product }) => {
    const minStock = product.min_stock ?? 5;
    const isOutOfStock = product.stock <= 0;
    const isBelowMin = !isOutOfStock && product.stock < minStock;
    const isAtMin = !isOutOfStock && product.stock === minStock;
    return (
      <div className="bg-card rounded-xl border border-border p-4 space-y-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.sku || getCategoryName(product.category)}</p>
          </div>
          <Badge variant={product.status === "active" ? "default" : "secondary"} className={`shrink-0 ${product.status === "active" ? "bg-emerald-100 text-emerald-700 border-0" : ""}`}>
            {product.status === "active" ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(isOutOfStock || isBelowMin || isAtMin) && <AlertTriangle className={`h-4 w-4 ${isOutOfStock ? "text-red-500" : "text-amber-500"}`} />}
            <span className={`font-semibold text-sm ${isOutOfStock ? "text-red-600" : (isBelowMin || isAtMin) ? "text-amber-600" : "text-foreground"}`}>
              {product.stock} {product.unit}
            </span>
            {isOutOfStock && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded">AGOTADO</span>}
            {isBelowMin && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 rounded">STOCK CRÍTICO</span>}
            {isAtMin && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">STOCK MÍNIMO</span>}
          </div>
          <span className="font-bold text-foreground">${(product.retail_sale_price ?? product.sale_price ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex items-center justify-end gap-1 border-t border-border pt-2 flex-wrap">
          {!product.barcode && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-11 px-3" 
              onClick={() => handleGenerateBarcode(product)}
              title="Generar código de barras"
              disabled={generatingId === product.id}
            >
              {generatingId === product.id
                ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                : <Barcode className="h-4 w-4 text-muted-foreground mr-1" />}
              Código
            </Button>
          )}
          {isAdmin && (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-11 px-3" 
                onClick={() => onEdit(product)}
                {...createButtonProps('edit')}
              >
                <Pencil className="h-4 w-4 text-muted-foreground mr-1" /> Editar
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-11 px-3 text-red-400 hover:text-red-600" 
                onClick={() => onDelete(product)}
                {...createButtonProps('delete')}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
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
    <>
      {/* Desktop: table */}
      <div className="hidden md:block bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table role="table" aria-label="Lista de productos" aria-describedby="products-table-desc">
            <TableHeader>
              <TableRow className="bg-muted/40" role="row">
                <TableHead className="font-semibold text-muted-foreground" role="columnheader">Producto</TableHead>
                <TableHead className="font-semibold text-muted-foreground" role="columnheader">SKU</TableHead>
                <TableHead className="font-semibold text-muted-foreground" role="columnheader">Categoría</TableHead>
                {isAdmin && <TableHead className="font-semibold text-muted-foreground text-right" role="columnheader">Precio Compra</TableHead>}
                <TableHead className="font-semibold text-muted-foreground text-right" role="columnheader">Precio Menudeo</TableHead>
                <TableHead className="font-semibold text-muted-foreground text-right" role="columnheader">Stock</TableHead>
                <TableHead className="font-semibold text-muted-foreground text-center" role="columnheader">Estado</TableHead>
                <TableHead className="font-semibold text-muted-foreground text-center" role="columnheader">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => <ProductRow key={product.id} product={product} />)}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </>
  );
}