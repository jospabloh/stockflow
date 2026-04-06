import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
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

export default function Suppliers() {
  const { businessId } = useBusinessContext();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supFormOpen, setSupFormOpen] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [supForm, setSupForm] = useState({ name: "", contact_name: "", email: "", phone: "" });

  useEffect(() => {
    const checkAndLoad = async () => {
      try {
        if (businessId) {
          const sups = await base44.entities.Supplier.filter({ business_id: businessId });
          setSuppliers(sups);
        }
      } catch (err) {
        console.error("Error loading suppliers:", err);
      } finally {
        setLoading(false);
      }
    };
    
    checkAndLoad();
  }, [businessId]);

  const handleSaveSupplier = async () => {
    if (!supForm.name.trim()) {
      toast.error("El nombre del proveedor es requerido");
      return;
    }
    try {
      if (editingSup) {
        const response = await base44.functions.invoke('updateSupplierSafe', {
          supplier_id: editingSup.id,
          updates: supForm
        });
        if (!response.data.success) {
          toast.error(`Error: ${response.data.error || 'No se pudo actualizar'}`);
          return;
        }
        toast.success("✓ Proveedor actualizado");
      } else {
        await base44.entities.Supplier.create({ ...supForm, business_id: businessId });
        toast.success("✓ Proveedor creado exitosamente");
      }
      const sups = await base44.entities.Supplier.filter({ business_id: businessId });
      setSuppliers(sups);
      setSupFormOpen(false);
      setEditingSup(null);
      setSupForm({ name: "", contact_name: "", email: "", phone: "" });
    } catch (error) {
      console.error("Save supplier error:", error);
      toast.error(`Error al guardar proveedor: ${error.message || 'Intenta de nuevo'}`);
    }
  };

  const handleDeleteSupplier = async (id) => {
    const response = await base44.functions.invoke('deleteSupplierSafe', { supplier_id: id });
    if (!response.data.success) {
      toast.error(response.data.error || 'No se pudo eliminar');
      return;
    }
    setSuppliers(suppliers.filter((s) => s.id !== id));
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
          <h1 className="font-semibold text-slate-700 text-lg">Proveedores</h1>
          <Button 
            size="sm" 
            className="bg-indigo-600 hover:bg-indigo-700" 
            onClick={() => { setEditingSup(null); setSupForm({ name: "", contact_name: "", email: "", phone: "" }); setSupFormOpen(true); }} 
            {...createButtonProps('add')}
          >
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </div>
        <Table {...createTableProps('suppliers-table')}>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((sup) => (
              <TableRow key={sup.id}>
                <TableCell className="font-medium">{sup.name}</TableCell>
                <TableCell className="text-slate-500">{sup.contact_name || "—"}</TableCell>
                <TableCell className="text-slate-500">{sup.email || "—"}</TableCell>
                <TableCell className="text-slate-500">{sup.phone || "—"}</TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingSup(sup); setSupForm({ name: sup.name, contact_name: sup.contact_name || "", email: sup.email || "", phone: sup.phone || "" }); setSupFormOpen(true); }} {...createButtonProps('edit')}>
                    <Pencil className="h-4 w-4 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteSupplier(sup.id)} {...createButtonProps('delete')}>
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Supplier Dialog */}
      <Dialog open={supFormOpen} onOpenChange={setSupFormOpen}>
        <DialogContent className="pb-safe">
          <DialogHeader>
            <DialogTitle>{editingSup ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre *</Label>
              <Input value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Contacto</Label>
              <Input value={supForm.contact_name} onChange={(e) => setSupForm({ ...supForm, contact_name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSupFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveSupplier} disabled={!supForm.name} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}