import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBusinessContext } from "@/components/BusinessContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const emptyForm = { name: "", business_name: "", email: "", phone: "", address: "", rfc: "", notes: "", status: "active", force_wholesale_all_products: false, force_purchase_all_products: false };

export default function ClientsManager() {
  const { businessId } = useBusinessContext();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // CRITICAL FIX: Filter clients by business_id to prevent cross-tenant data leaks
  const load = () => businessId 
    ? base44.entities.Client.filter({ business_id: businessId }, "-created_date").then(setClients)
    : Promise.resolve().then(() => setClients([]));

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, business_name: c.business_name || "", email: c.email || "", phone: c.phone || "", address: c.address || "", rfc: c.rfc || "", notes: c.notes || "", status: c.status || "active", force_wholesale_all_products: c.force_wholesale_all_products || false, force_purchase_all_products: c.force_purchase_all_products || false }); setFormOpen(true); };

  const handleSave = async () => {
    // Validate required fields
    if (!form.name?.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!form.phone?.trim()) {
      toast.error("El teléfono es requerido");
      return;
    }

    // Frontend: mutually exclusive flags
    if (form.force_wholesale_all_products && form.force_purchase_all_products) {
      toast.error('No es posible activar "precio mayoreo" y "precio de compra" al mismo tiempo.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        if (editing.business_id !== businessId) {
          toast.error("No tienes permiso para editar este cliente");
          setFormOpen(false);
          return;
        }
        const response = await base44.functions.invoke('updateClientSafe', { client_id: editing.id, updates: form });
        if (!response.data.success) {
          toast.error(`Error: ${response.data.error}`);
          setSaving(false);
          return;
        }
        toast.success("✓ Cliente actualizado");
      } else {
        const response = await base44.functions.invoke('createClientSafe', { ...form, business_id: businessId });
        if (!response.data.success) {
          toast.error(`Error: ${response.data.error}`);
          setSaving(false);
          return;
        }
        toast.success("✓ Cliente creado");
      }
      await load();
      setFormOpen(false);
    } catch (error) {
      toast.error(`Error: ${error.message || 'No se pudo guardar el cliente'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (client) => {
    // CRITICAL FIX: Validate ownership before delete
    if (client.business_id !== businessId) {
      toast.error("No tienes permiso para eliminar este cliente");
      return;
    }
    // Filter quotations by both client_name AND business_id for safety
    const quots = await base44.entities.Quotation.filter({ 
      client_name: client.name,
      business_id: businessId 
    });
    if (quots.length > 0) {
      toast.error(`No se puede eliminar: ${quots.length} cotización(es) están registradas para este cliente.`);
      return;
    }
    await base44.entities.Client.delete(client.id);
    setClients(clients.filter(c => c.id !== client.id));
    toast.success("Cliente eliminado");
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.business_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border-0 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700 text-lg">Clientes</h3>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo cliente
        </Button>
      </div>
      <Input
        placeholder="Buscar cliente..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Nombre Negocio</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>RFC</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-slate-500">{c.business_name || "—"}</TableCell>
              <TableCell className="text-slate-500">{c.email || "—"}</TableCell>
              <TableCell className="text-slate-500">{c.phone || "—"}</TableCell>
              <TableCell className="text-slate-500">{c.rfc || "—"}</TableCell>
              <TableCell>
                <Badge className={c.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                  {c.status === "active" ? <><UserCheck className="h-3 w-3 mr-1 inline" />Activo</> : <><UserX className="h-3 w-3 mr-1 inline" />Inactivo</>}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                  <Pencil className="h-4 w-4 text-slate-400" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c)}>
                  <Trash2 className="h-4 w-4 text-slate-400" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-slate-400 py-8">No hay clientes registrados</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Nombre Negocio</Label>
                <Input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono *</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            </div>
            <div>
              <Label>Dirección</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RFC</Label>
                <Input value={form.rfc} onChange={e => setForm({ ...form, rfc: e.target.value })} />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            {/* Pricing flags */}
            <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configuración de precios</p>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="force_wholesale"
                  checked={form.force_wholesale_all_products}
                  onCheckedChange={(checked) => {
                    setForm(prev => ({ ...prev, force_wholesale_all_products: !!checked, ...(checked ? { force_purchase_all_products: false } : {}) }));
                  }}
                />
                <Label htmlFor="force_wholesale" className="text-sm leading-snug cursor-pointer">
                  Aplicar precio mayoreo en todos los productos y en cualquier cantidad
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="force_purchase"
                  checked={form.force_purchase_all_products}
                  onCheckedChange={(checked) => {
                    setForm(prev => ({ ...prev, force_purchase_all_products: !!checked, ...(checked ? { force_wholesale_all_products: false } : {}) }));
                  }}
                />
                <Label htmlFor="force_purchase" className="text-sm leading-snug cursor-pointer">
                  Aplicar precio de compra en todos los productos y en cualquier cantidad
                </Label>
              </div>
              {(form.force_wholesale_all_products || form.force_purchase_all_products) && (
                <p className="text-xs text-indigo-600 font-medium">
                  ⚡ {form.force_purchase_all_products ? "Precio de compra" : "Precio mayoreo"} activo para este cliente
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.name?.trim() || !form.phone?.trim() || saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}