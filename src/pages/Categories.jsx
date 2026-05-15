import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { useBusinessContext } from "@/components/BusinessContext";
import { createButtonProps, createTableProps } from "@/lib/a11y";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Categories() {
  const { businessId } = useBusinessContext();
  const { can } = usePermissions();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#6366f1", wholesale_min_qty: "" });
  const [deleteCatId, setDeleteCatId] = useState(null);
  const [deleteCatReason, setDeleteCatReason] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAndLoad = async () => {
      try {
        const u = await base44.auth.me();
        setIsAdmin(u?.role === "admin");
        
        if (businessId) {
          const cats = await base44.entities.Category.filter({ business_id: businessId });
          setCategories(cats);
        }
      } catch (err) {
        console.error("Error loading categories:", err);
      } finally {
        setLoading(false);
      }
    };
    
    checkAndLoad();
  }, [businessId]);

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) {
      toast.error("El nombre de la categoría es requerido");
      return;
    }
    try {
      if (editingCat) {
        const catUpdates = {
          ...catForm,
          wholesale_min_qty: catForm.wholesale_min_qty !== "" ? Number(catForm.wholesale_min_qty) : null,
        };
        const response = await base44.functions.invoke('updateCategorySafe', {
          category_id: editingCat.id,
          updates: catUpdates
        });
        if (!response.data.success) {
          toast.error(`Error: ${response.data.error || 'No se pudo actualizar'}`);
          return;
        }
        toast.success("✓ Categoría actualizada");
      } else {
        const newCat = {
          ...catForm,
          wholesale_min_qty: catForm.wholesale_min_qty !== "" ? Number(catForm.wholesale_min_qty) : undefined,
          business_id: businessId,
        };
        await base44.entities.Category.create(newCat);
        toast.success("✓ Categoría creada exitosamente");
      }
      const cats = await base44.entities.Category.filter({ business_id: businessId });
      setCategories(cats);
      setCatFormOpen(false);
      setEditingCat(null);
      setCatForm({ name: "", description: "", color: "#6366f1", wholesale_min_qty: "" });
    } catch (error) {
      console.error("Save category error:", error);
      toast.error(`Error al guardar categoría: ${error.message || 'Intenta de nuevo'}`);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!isAdmin && !deleteCatReason.trim()) {
      toast.error("Debes proporcionar una razón para eliminar");
      return;
    }
    const response = await base44.functions.invoke('deleteCategorySafe', { 
      category_id: id,
      deletion_reason: deleteCatReason || undefined
    });
    if (!response.data.success) {
      toast.error(response.data.error || 'No se pudo eliminar');
      return;
    }
    setCategories(categories.filter((c) => c.id !== id));
    setDeleteCatId(null);
    setDeleteCatReason("");
    toast.success("Categoría eliminada");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Card className="border-0 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-semibold text-slate-700 text-lg">Categorías</h1>
          <Button 
            size="sm" 
            className="bg-indigo-600 hover:bg-indigo-700" 
            onClick={() => { setEditingCat(null); setCatForm({ name: "", description: "", color: "#6366f1" }); setCatFormOpen(true); }} 
            {...createButtonProps('add')}
          >
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
        </div>
        <Table {...createTableProps('categories-table')}>
          <TableHeader>
            <TableRow>
              <TableHead>Color</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Mín. Mayoreo</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell><div className="h-6 w-6 rounded-full" style={{ backgroundColor: cat.color || "#6366f1" }} /></TableCell>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell className="text-slate-500">{cat.description || "—"}</TableCell>
                <TableCell className="text-right text-slate-500 text-sm">
                  {cat.wholesale_min_qty > 0 ? `${cat.wholesale_min_qty} uds.` : "—"}
                </TableCell>
                <TableCell className="text-center">
                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, description: cat.description || "", color: cat.color || "#6366f1", wholesale_min_qty: cat.wholesale_min_qty ?? "" }); setCatFormOpen(true); }} {...createButtonProps('edit')}>
                     <Pencil className="h-4 w-4 text-slate-400" />
                   </Button>
                   {can('Categorias', 'delete') && (
                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteCatId(cat.id)} {...createButtonProps('delete')}>
                     <Trash2 className="h-4 w-4 text-slate-400" />
                   </Button>
                   )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Category Dialog */}
      <Dialog open={catFormOpen} onOpenChange={setCatFormOpen}>
        <DialogContent className="pb-safe">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input type="color" value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} className="w-14 h-10 p-1" />
                <Input value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Cantidad mínima para precio mayoreo</Label>
              <Input
                type="number" min={0} step="1"
                value={catForm.wholesale_min_qty}
                placeholder="Ej: 10 (dejar vacío para no aplicar)"
                onChange={(e) => {
                  const val = e.target.value;
                  setCatForm({ ...catForm, wholesale_min_qty: val === "" ? "" : Math.max(0, parseInt(val) || 0) });
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Si la cantidad total de productos de esta categoría en una cotización alcanza este mínimo, se aplica precio mayoreo automáticamente.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCatFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveCategory} disabled={!catForm.name} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      {deleteCatId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Eliminar categoría</p>
                <p className="text-sm text-slate-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            {!isAdmin && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <Label className="text-xs text-amber-800 font-medium block mb-2">Razón de eliminación *</Label>
                <Textarea 
                  placeholder="Explica por qué necesitas eliminar esta categoría..."
                  value={deleteCatReason} 
                  onChange={(e) => setDeleteCatReason(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <p className="text-xs text-amber-600 mt-2">El admin revisará esta acción</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setDeleteCatId(null); setDeleteCatReason(""); }}>Cancelar</Button>
              <Button 
                className="bg-red-600 hover:bg-red-700" 
                onClick={() => handleDeleteCategory(deleteCatId)}
                disabled={!isAdmin && !deleteCatReason.trim()}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}