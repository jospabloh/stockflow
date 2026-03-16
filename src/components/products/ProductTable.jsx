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
import { Pencil, Trash2, AlertTriangle } from "lucide-react";

export default function ProductTable({ products, categories, onEdit, onDelete, isAdmin }) {
  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || "—";

  const ProductRow = ({ product }) => {
    const minStock = product.min_stock ?? 5;
    const isOutOfStock = product.stock <= 0;
    const isBelowMin = !isOutOfStock && product.stock < minStock;
    const isAtMin = !isOutOfStock && product.stock === minStock;
    return (
      <TableRow key={product.id} className="hover:bg-muted/40 transition-colors">
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
          ${product.sale_price?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              {(isOutOfStock || isBelowMin || isAtMin) && <AlertTriangle className={`h-4 w-4 ${isOutOfStock ? "text-red-500" : "text-amber-500"}`} />}
              <span className={`font-semibold ${isOutOfStock ? "text-red-600" : (isBelowMin || isAtMin) ? "text-amber-600" : "text-slate-700"}`}>
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
            {isAdmin && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(product)}>
                  <Pencil className="h-4 w-4 text-slate-400" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(product)}>
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
      <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 truncate">{product.name}</p>
            <p className="text-xs text-slate-400">{product.sku || getCategoryName(product.category)}</p>
          </div>
          <Badge variant={product.status === "active" ? "default" : "secondary"} className={`shrink-0 ${product.status === "active" ? "bg-emerald-100 text-emerald-700 border-0" : ""}`}>
            {product.status === "active" ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(isOutOfStock || isBelowMin || isAtMin) && <AlertTriangle className={`h-4 w-4 ${isOutOfStock ? "text-red-500" : "text-amber-500"}`} />}
            <span className={`font-semibold text-sm ${isOutOfStock ? "text-red-600" : (isBelowMin || isAtMin) ? "text-amber-600" : "text-slate-700"}`}>
              {product.stock} {product.unit}
            </span>
            {isOutOfStock && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded">AGOTADO</span>}
            {isBelowMin && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 rounded">STOCK CRÍTICO</span>}
            {isAtMin && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded">STOCK MÍNIMO</span>}
          </div>
          <span className="font-bold text-slate-700">${product.sale_price?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
        </div>
        {isAdmin && (
          <div className="flex items-center justify-end gap-1 border-t border-slate-50 pt-2">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onEdit(product)}>
              <Pencil className="h-4 w-4 text-slate-400 mr-1" /> Editar
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-red-400 hover:text-red-600" onClick={() => onDelete(product)}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
        No hay productos registrados
      </div>
    );
  }

  return (
    <>
      {/* Desktop: table */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="font-semibold text-slate-600">Producto</TableHead>
                <TableHead className="font-semibold text-slate-600">SKU</TableHead>
                <TableHead className="font-semibold text-slate-600">Categoría</TableHead>
                {isAdmin && <TableHead className="font-semibold text-slate-600 text-right">Precio Compra</TableHead>}
                <TableHead className="font-semibold text-slate-600 text-right">Precio Venta</TableHead>
                <TableHead className="font-semibold text-slate-600 text-right">Stock</TableHead>
                <TableHead className="font-semibold text-slate-600 text-center">Estado</TableHead>
                <TableHead className="font-semibold text-slate-600 text-center">Acciones</TableHead>
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