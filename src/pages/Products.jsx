import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import SelectWrapper from "@/components/wrappers/SelectWrapper";
import TableSkeleton from "@/components/skeletons/TableSkeleton";
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
import ExportMenu from "@/components/common/ExportMenu";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Products() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { canSee } = useFieldVisibility("Productos");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [deleteProduct, setDeleteProduct] = useState(null);
  const [businessId, setBusinessId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    if (params.get("filter") === "low_stock") {
      setStockFilter("low");
    }
  }, []);

  const loadData = async (bId) => {
    if (!bId) return;
    Promise.all([
      base44.entities.Product.filter({ business_id: bId }, "-created_date", 500),
      base44.entities.Category.filter({ business_id: bId }),
    ]).then(([prods, cats]) => {
      setProducts(prods);
      setCategories(cats);
      setLoading(false);
    });
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      setIsAdmin(u?.role === "admin");
      setBusinessId(u?.business_id || null);
      loadData(u?.business_id || null);
    }).catch(() => setLoading(false));
  }, []);

  const isLowStockProduct = (product) => {
    if (!product || product.status !== "active") return false;

    const stock = Number(product.stock ?? 0);
    const minStock = Number(product.min_stock);

    if (!Number.isFinite(minStock)) return false;

    return stock <= minStock;
  };

  const filteredProducts = products.filter((p) => {
    const searchTerm = search.toLowerCase();

    const matchSearch =
      p.name?.toLowerCase().includes(searchTerm) ||
      p.sku?.toLowerCase().includes(searchTerm) ||
      p.barcode?.toLowerCase().includes(searchTerm);

    const matchCategory = categoryFilter === "all" || p.category === categoryFilter;

    const matchStock =
      stockFilter === "all" ||
      (stockFilter === "low" && isLowStockProduct(p)) ||
      (stockFilter === "out" && p.status === "active" && Number(p.stock ?? 0) <= 0);

    return matchSearch && matchCategory && matchStock;
  });

  const handleEdit = (product) => {
    navigate(`/Products/edit/${product.id}`);
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    try {
      const response = await base44.functions.invoke('deleteProductSafe', {
        product_id: deleteProduct.id,
      });
      if (response.data?.success) {
        toast.success("Producto eliminado correctamente");
        setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id));
      } else {
        toast.error(response.data?.error || "No se pudo eliminar el producto");
      }
    } catch (error) {
      toast.error(`Error al eliminar: ${error.message}`);
    } finally {
      setDeleteProduct(null);
    }
  };

  const exportColumns = [
    { key: "name", label: "Nombre", type: "text" },
    { key: "sku", label: "SKU", type: "text" },
    { key: "barcode", label: "Código de barras", type: "text" },
    ...(isAdmin ? [{ key: "purchase_price", label: "Precio Compra", type: "currency" }] : []),
    { key: "retail_sale_price", label: "Precio Venta", type: "currency" },
    { key: "stock", label: "Stock", type: "number" },
    { key: "unit", label: "Unidad", type: "text" },
  ];

  const exportRows = filteredProducts.map((p) => ({
    name: p.name,
    sku: p.sku || "",
    barcode: p.barcode || "",
    ...(isAdmin ? { purchase_price: p.purchase_price || 0 } : {}),
    retail_sale_price: p.retail_sale_price,
    stock: p.stock,
    unit: p.unit || "pieza",
  }));

  if (loading) {
    return <TableSkeleton rows={8} columns={6} />;
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
            aria-label="Buscar productos por nombre, SKU o código de barras"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
           <SelectWrapper
             value={categoryFilter}
             onValueChange={setCategoryFilter}
             placeholder="Categoría"
             ariaLabel="Filtrar por categoría"
             options={[
               { value: "all", label: "Todas" },
               ...categories.map((c) => ({ value: c.id, label: c.name })),
             ]}
           />
           <SelectWrapper
             value={stockFilter}
             onValueChange={setStockFilter}
             placeholder="Stock"
             ariaLabel="Filtrar por estado de stock"
             options={[
               { value: "all", label: "Todo" },
               { value: "low", label: "Stock Bajo" },
               { value: "out", label: "Agotado" },
             ]}
           />
          <ExportMenu
            columns={exportColumns}
            rows={exportRows}
            filename="productos"
            title="Productos"
            variant="outline"
            size="default"
          />
          {can('Productos', 'create') && (
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate("/Products/new")}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* Products table */}
       {canSee("view") && (
       <ProductTable
         products={filteredProducts}
         categories={categories}
         onEdit={handleEdit}
         onDelete={setDeleteProduct}
         isAdmin={isAdmin}
         canShowCost={canSee("cost_price")}
         onBarcodeGenerated={() => loadData(businessId)}
         canEdit={can('Productos', 'edit_name') && canSee("edit_name")}
          canDelete={can('Productos', 'delete') && canSee("delete")}
       />
       )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={() => setDeleteProduct(null)}>
        <AlertDialogContent role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-desc">
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-title">¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription id="delete-desc">
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