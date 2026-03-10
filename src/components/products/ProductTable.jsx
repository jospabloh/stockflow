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

export default function ProductTable({ products, categories, onEdit, onDelete }) {
  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || "—";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="font-semibold text-slate-600">Producto</TableHead>
              <TableHead className="font-semibold text-slate-600">SKU</TableHead>
              <TableHead className="font-semibold text-slate-600">Categoría</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right">Precio Venta</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right">Stock</TableHead>
              <TableHead className="font-semibold text-slate-600 text-center">Estado</TableHead>
              <TableHead className="font-semibold text-slate-600 text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  No hay productos registrados
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const isLowStock = product.stock <= (product.min_stock || 5);
                return (
                  <TableRow key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-800">{product.name}</p>
                        {product.barcode && <p className="text-xs text-slate-400">{product.barcode}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{product.sku || "—"}</TableCell>
                    <TableCell className="text-slate-600">{getCategoryName(product.category)}</TableCell>
                    <TableCell className="text-right font-semibold text-slate-700">
                      ${product.sale_price?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isLowStock && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        <span className={`font-semibold ${isLowStock ? "text-amber-600" : "text-slate-700"}`}>
                          {product.stock} {product.unit}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={product.status === "active" ? "default" : "secondary"} className={product.status === "active" ? "bg-emerald-100 text-emerald-700 border-0" : ""}>
                        {product.status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(product)}>
                          <Pencil className="h-4 w-4 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(product)}>
                          <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}