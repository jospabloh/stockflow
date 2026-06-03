import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Tag } from "lucide-react";
import { useBusinessContext } from "@/components/BusinessContext";
import { createButtonProps, createTableProps } from "@/lib/a11y";
import { MobileSelect } from "@/components/ui/MobileSelect";
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
import { celebrate } from "@/lib/celebrate";
import { seedAndDedupeCatalog } from "@/lib/seedCatalog";

// Rubros predeterminados que se siembran la primera vez por negocio
const DEFAULT_RUBROS = [
  { name: "Ventas", kind: "income" },
  { name: "Otros ingresos", kind: "income" },
  { name: "Renta", kind: "expense" },
  { name: "Nómina", kind: "expense" },
  { name: "Servicios", kind: "expense" },
  { name: "Compras de mercancía", kind: "expense" },
  { name: "Mantenimiento", kind: "expense" },
  { name: "Publicidad", kind: "expense" },
  { name: "Retiro de utilidades", kind: "expense" },
  { name: "Otros", kind: "expense" },
];

const KIND_META = {
  income: { label: "Ingreso", color: "bg-emerald-100 text-emerald-700" },
  expense: { label: "Egreso", color: "bg-rose-100 text-rose-700" },
};

const EMPTY_FORM = { name: "", kind: "expense" };

export default function Rubros() {
  const { businessId } = useBusinessContext();
  const [rubros, setRubros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    if (!businessId) return;
    try {
      const data = await seedAndDedupeCatalog({
        entity: "Rubro",
        businessId,
        defaults: DEFAULT_RUBROS,
        keyOf: (r) => `${r.name}|${r.kind}`,
      });
      setRubros(data);
    } catch (err) {
      console.error("Error loading rubros:", err);
      toast.error("No se pudieron cargar los rubros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ name: r.name, kind: r.kind }); setFormOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
    try {
      if (editing) {
        await base44.entities.Rubro.update(editing.id, { name: form.name.trim(), kind: form.kind });
        toast.success("✓ Rubro actualizado");
      } else {
        await base44.entities.Rubro.create({
          name: form.name.trim(),
          kind: form.kind,
          active: true,
          is_system: false,
          business_id: businessId,
        });
        toast.success("✓ Rubro creado");
        celebrate();
      }
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Rubro.delete(id);
      setRubros(rubros.filter((r) => r.id !== id));
      toast.success("Rubro eliminado");
    } catch (error) {
      toast.error(`Error al eliminar: ${error.message}`);
    }
  };

  const handleToggle = async (r) => {
    try {
      await base44.entities.Rubro.update(r.id, { active: !r.active });
      setRubros(rubros.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)));
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
            <h1 className="font-semibold text-slate-700 text-lg flex items-center gap-2">
              <Tag className="h-5 w-5 text-indigo-500" /> Rubros
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Categorías de ingresos y egresos para el módulo de Utilidad</p>
          </div>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={openNew}
            {...createButtonProps('add')}
          >
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </div>
        <Table {...createTableProps('rubros-table')}>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-center">Activo</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rubros.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No hay rubros. Crea el primero.
                </TableCell>
              </TableRow>
            )}
            {rubros.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <Badge className={`${(KIND_META[r.kind] || KIND_META.expense).color} border-0 text-xs`}>
                    {(KIND_META[r.kind] || KIND_META.expense).label}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Switch checked={r.active !== false} onCheckedChange={() => handleToggle(r)} />
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} {...createButtonProps('edit')}>
                    <Pencil className="h-4 w-4 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(r.id)} {...createButtonProps('delete')}>
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="pb-safe">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Rubro" : "Nuevo Rubro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Renta, Nómina, Ventas..."
              />
            </div>
            <div>
              <Label>Tipo *</Label>
              <MobileSelect
                value={form.kind}
                onValueChange={(v) => setForm((p) => ({ ...p, kind: v }))}
                options={[
                  { value: "expense", label: "Egreso" },
                  { value: "income", label: "Ingreso" },
                ]}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.name.trim()} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
