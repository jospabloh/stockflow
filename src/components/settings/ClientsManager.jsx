import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
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

const emptyForm = { name: "", email: "", phone: "", address: "", rfc: "", notes: "", status: "active" };

export default function ClientsManager() {
  const { businessId } = useBusinessContext();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => base44.entities.Client.list("-created_date").then(setClients);

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "", rfc: c.rfc || "", notes: c.notes || "", status: c.status || "active" }); setFormOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      await base44.entities.Client.update(editing.id, form);
    } else {
      await base44.entities.Client.create({ ...form, business_id: businessId });
    }
    await load();
    setSaving(false);
    setFormOpen(false);
    toast.success(editing ? "Cliente actualizado" : "Cliente creado");
  };

  const handleDelete = async (client) => {
    const quots = await base44.entities.Quotation.filter({ client_name: client.name });
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
              <TableCell colSpan={6} className="text-center text-slate-400 py-8">No hay clientes registrados</TableCell>
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
            <div>
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Teléfono</Label>
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
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.name || saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}