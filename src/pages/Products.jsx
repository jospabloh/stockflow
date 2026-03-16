import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Upload, Download } from "lucide-react";
import { MobileSelect } from "@/components/ui/MobileSelect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ProductTable from "@/components/products/ProductTable";
import ProductFormDialog from "@/components/products/ProductFormDialog";
import { toast } from "sonner";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteProduct, setDeleteProduct] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("filter") === "low_stock") {
      setStockFilter("low");
    }
  }, []);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Product.list("-created_date", 500),
      base44.entities.Category.list(),
    ]).then(([prods, cats]) => {
      setProducts(prods);
      setCategories(cats);
      setLoading(false);
    });
  };

  useEffect(() => {
    base44.auth.me().then(u => setIsAdmin(u?.role === "admin")).catch(() => {});
    loadData();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchStock = stockFilter === "all" ||
      (stockFilter === "low" && p.stock <= (p.min_stock || 5)) ||
      (stockFilter === "out" && p.stock <= 0);
    return matchSearch && matchCategory && matchStock;
  });

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteProduct) {
      const movs = await base44.entities.Movement.filter({ product_id: deleteProduct.id });
      if (movs.length > 0) {
        toast.error(`No se puede eliminar: hay ${movs.length} movimiento(s) registrado(s) para este producto.`);
        setDeleteProduct(null);
        return;
      }
      await base44.entities.Product.delete(deleteProduct.id);
      setDeleteProduct(null);
      loadData();
    }
  };

  const handleExportCSV = () => {
    const headers = isAdmin
      ? ["Nombre", "SKU", "Código de barras", "Precio Compra", "Precio Venta", "Stock", "Unidad"]
      : ["Nombre", "SKU", "Código de barras", "Precio Venta", "Stock", "Unidad"];
    const rows = filteredProducts.map((p) => isAdmin
      ? [p.name, p.sku || "", p.barcode || "", p.purchase_price || 0, p.sale_price, p.stock, p.unit || "pieza"]
      : [p.name, p.sku || "", p.barcode || "", p.sale_price, p.stock, p.unit || "pieza"]
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nombre, SKU o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo</SelectItem>
              <SelectItem value="low">Stock Bajo</SelectItem>
              <SelectItem value="out">Agotado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          {isAdmin && (
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => { setEditingProduct(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* Products table */}
      <ProductTable
        products={filteredProducts}
        categories={categories}
        onEdit={handleEdit}
        onDelete={setDeleteProduct}
        isAdmin={isAdmin}
      />

      {/* Form dialog */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        onSaved={loadData}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deleteProduct?.name}" permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}