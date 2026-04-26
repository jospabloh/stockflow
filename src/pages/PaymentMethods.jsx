import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function PaymentMethods() {
  const { businessId } = useBusinessContext();
  const { can } = usePermissions();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pmFormOpen, setPmFormOpen] = useState(false);
  const [editingPm, setEditingPm] = useState(null);
  const [pmForm, setPmForm] = useState({ name: "" });

  useEffect(() => {
    const checkAndLoad = async () => {
      try {
        if (businessId) {
          const pms = await base44.entities.PaymentMethod.filter({ business_id: businessId });
          setPaymentMethods(pms || []);
        }
      } catch (err) {
        console.error("Error loading payment methods:", err);
      } finally {
        setLoading(false);
      }
    };
    
    checkAndLoad();
  }, [businessId]);

  const handleSavePaymentMethod = async () => {
    if (!pmForm.name.trim()) { 
      toast.error("El nombre es requerido"); 
      return; 
    }
    try {
      if (editingPm) {
        await base44.entities.PaymentMethod.update(editingPm.id, { name: pmForm.name });
        toast.success("✓ Forma de pago actualizada");
      } else {
        await base44.entities.PaymentMethod.create({ name: pmForm.name, active: true, business_id: businessId });
        toast.success("✓ Forma de pago creada");
      }
      const pms = await base44.entities.PaymentMethod.filter({ business_id: businessId });
      setPaymentMethods(pms);
      setPmFormOpen(false);
      setEditingPm(null);
      setPmForm({ name: "" });
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleDeletePaymentMethod = async (id) => {
    try {
      await base44.entities.PaymentMethod.delete(id);
      setPaymentMethods(paymentMethods.filter(p => p.id !== id));
      toast.success("Forma de pago eliminada");
    } catch (error) {
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };

  const handleTogglePaymentMethod = async (pm) => {
    try {
      await base44.entities.PaymentMethod.update(pm.id, { active: !pm.active });
      setPaymentMethods(paymentMethods.map(p => p.id === pm.id ? { ...p, active: !p.active } : p));
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
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
          <div>
            <h1 className="font-semibold text-slate-700 text-lg">Formas de Pago</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Se usan en movimientos y cotizaciones</p>
          </div>
          {can('Tipo de Pago', 'create') && (
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => { setEditingPm(null); setPmForm({ name: "" }); setPmFormOpen(true); }}
              {...createButtonProps('add')}
            >
              <Plus className="h-4 w-4 mr-1" /> Nueva
            </Button>
          )}
        </div>
        <Table {...createTableProps('payment-methods-table')}>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-center">Activa</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentMethods.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No hay formas de pago. Crea la primera.
                </TableCell>
              </TableRow>
            )}
            {paymentMethods.map((pm) => (
              <TableRow key={pm.id}>
                <TableCell className="font-medium">{pm.name}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={pm.active !== false} onCheckedChange={() => handleTogglePaymentMethod(pm)} />
                </TableCell>
                <TableCell className="text-center">
                  {can('Tipo de Pago', 'edit_name') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingPm(pm); setPmForm({ name: pm.name }); setPmFormOpen(true); }} {...createButtonProps('edit')}>
                      <Pencil className="h-4 w-4 text-slate-400" />
                    </Button>
                  )}
                  {can('Tipo de Pago', 'delete') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeletePaymentMethod(pm.id)} {...createButtonProps('delete')}>
                      <Trash2 className="h-4 w-4 text-slate-400" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Payment Method Dialog */}
      <Dialog open={pmFormOpen} onOpenChange={setPmFormOpen}>
        <DialogContent className="pb-safe">
          <DialogHeader>
            <DialogTitle>{editingPm ? "Editar Forma de Pago" : "Nueva Forma de Pago"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={pmForm.name}
                onChange={(e) => setPmForm({ name: e.target.value })}
                placeholder="Ej: Efectivo, Transferencia, Tarjeta..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPmFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSavePaymentMethod} disabled={!pmForm.name.trim()} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}