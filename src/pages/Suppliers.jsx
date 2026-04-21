import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, X, Users } from "lucide-react";
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

const EMPTY_CONTACT = { name: "", email: "", phone: "" };
const EMPTY_FORM = { name: "", contact_name: "", email: "", phone: "", extra_contacts: [] };

function parseExtraContacts(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export default function Suppliers() {
  const { businessId } = useBusinessContext();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supFormOpen, setSupFormOpen] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [supForm, setSupForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});

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

  const openNew = () => {
    setEditingSup(null);
    setSupForm(EMPTY_FORM);
    setFieldErrors({});
    setSupFormOpen(true);
  };

  const openEdit = (sup) => {
    setEditingSup(sup);
    setSupForm({
      name: sup.name,
      contact_name: sup.contact_name || "",
      email: sup.email || "",
      phone: sup.phone || "",
      extra_contacts: parseExtraContacts(sup.extra_contacts),
    });
    setFieldErrors({});
    setSupFormOpen(true);
  };

  const addExtraContact = () =>
    setSupForm(prev => ({ ...prev, extra_contacts: [...prev.extra_contacts, { ...EMPTY_CONTACT }] }));

  const removeExtraContact = (i) =>
    setSupForm(prev => ({ ...prev, extra_contacts: prev.extra_contacts.filter((_, idx) => idx !== i) }));

  const updateExtraContact = (i, field, value) =>
    setSupForm(prev => ({
      ...prev,
      extra_contacts: prev.extra_contacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c),
    }));

  const handleSaveSupplier = async () => {
    const errors = {};
    if (!supForm.name.trim()) errors.name = true;
    if (!supForm.contact_name.trim()) errors.contact_name = true;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Por favor completa los campos requeridos");
      return;
    }
    setFieldErrors({});

    const payload = {
      ...supForm,
      extra_contacts: JSON.stringify(supForm.extra_contacts),
    };

    try {
      if (editingSup) {
        const response = await base44.functions.invoke('updateSupplierSafe', {
          supplier_id: editingSup.id,
          updates: payload,
        });
        if (!response.data.success) {
          toast.error(`Error: ${response.data.error || 'No se pudo actualizar'}`);
          return;
        }
        toast.success("✓ Proveedor actualizado");
      } else {
        const response = await base44.functions.invoke('createSupplierSafe', {
          ...payload,
          business_id: businessId,
        });
        if (!response.data.success) {
          toast.error(`Error: ${response.data.error || 'No se pudo crear'}`);
          return;
        }
        toast.success("✓ Proveedor creado exitosamente");
      }
      const sups = await base44.entities.Supplier.filter({ business_id: businessId });
      setSuppliers(sups);
      setSupFormOpen(false);
      setEditingSup(null);
      setSupForm(EMPTY_FORM);
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
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={openNew} {...createButtonProps('add')}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </div>
        <Table {...createTableProps('suppliers-table')}>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Contactos</TableHead>
              <TableHead>Email principal</TableHead>
              <TableHead>Teléfono principal</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((sup) => {
              const extras = parseExtraContacts(sup.extra_contacts);
              return (
                <TableRow key={sup.id}>
                  <TableCell className="font-medium">{sup.name}</TableCell>
                  <TableCell className="text-slate-500">
                    <span>{sup.contact_name || "—"}</span>
                    {extras.length > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-indigo-500 font-medium">
                        <Users className="h-3 w-3" />+{extras.length}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500">{sup.email || "—"}</TableCell>
                  <TableCell className="text-slate-500">{sup.phone || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sup)} {...createButtonProps('edit')}>
                      <Pencil className="h-4 w-4 text-slate-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteSupplier(sup.id)} {...createButtonProps('delete')}>
                      <Trash2 className="h-4 w-4 text-slate-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {suppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-400 py-8">No hay proveedores registrados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={supFormOpen} onOpenChange={setSupFormOpen}>
        <DialogContent className="max-w-lg flex flex-col max-h-[min(90dvh,700px)] p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <DialogTitle>{editingSup ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Supplier name */}
            <div>
              <Label>Nombre del Proveedor *</Label>
              <Input
                value={supForm.name}
                onChange={e => { setSupForm({ ...supForm, name: e.target.value }); if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: false })); }}
                className={fieldErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {fieldErrors.name && <p className="text-xs text-red-500 mt-1">Campo requerido</p>}
            </div>

            {/* Primary contact */}
            <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contacto Principal *</p>
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={supForm.contact_name}
                  onChange={e => { setSupForm({ ...supForm, contact_name: e.target.value }); if (fieldErrors.contact_name) setFieldErrors(p => ({ ...p, contact_name: false })); }}
                  className={fieldErrors.contact_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {fieldErrors.contact_name && <p className="text-xs text-red-500 mt-1">Campo requerido</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input value={supForm.email} onChange={e => setSupForm({ ...supForm, email: e.target.value })} />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input value={supForm.phone} onChange={e => setSupForm({ ...supForm, phone: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Extra contacts */}
            {supForm.extra_contacts.map((contact, i) => (
              <div key={i} className="border border-border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contacto {i + 2}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeExtraContact(i)}>
                    <X className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
                <div>
                  <Label>Nombre</Label>
                  <Input value={contact.name} onChange={e => updateExtraContact(i, 'name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email</Label>
                    <Input value={contact.email} onChange={e => updateExtraContact(i, 'email', e.target.value)} />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input value={contact.phone} onChange={e => updateExtraContact(i, 'phone', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}

            {/* Add contact button */}
            <Button variant="outline" size="sm" onClick={addExtraContact} className="w-full border-dashed text-slate-500 hover:text-indigo-600">
              <Plus className="h-4 w-4 mr-1" /> Agregar otro contacto
            </Button>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0 bg-card">
            <Button variant="outline" onClick={() => setSupFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSupplier} disabled={!supForm.name.trim() || !supForm.contact_name.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
