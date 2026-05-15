import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
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
import confetti from "canvas-confetti";

const emptyForm = { name: "", business_name: "", giro: "", email: "", phone: "", address: "", rfc: "", notes: "", status: "active", force_wholesale_all_products: false, force_purchase_all_products: false, force_zero_price: false };

export default function ClientsManager() {
  const { businessId } = useBusinessContext();
  const { can } = usePermissions();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // CRITICAL FIX: Filter clients by business_id to prevent cross-tenant data leaks
  const load = () => businessId 
    ? base44.entities.Client.filter({ business_id: businessId }, "-created_date").then(setClients)
    : Promise.resolve().then(() => setClients([]));

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setFieldErrors({}); setFormOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, business_name: c.business_name || "", giro: c.giro || "", email: c.email || "", phone: c.phone || "", address: c.address || "", rfc: c.rfc || "", notes: c.notes || "", status: c.status || "active", force_wholesale_all_products: c.force_wholesale_all_products || false, force_purchase_all_products: c.force_purchase_all_products || false, force_zero_price: c.force_zero_price || false }); setFieldErrors({}); setFormOpen(true); };

  const handleSave = async () => {
    // Validate required fields
    const errors = {};
    if (!form.name?.trim()) errors.name = true;
    if (!form.business_name?.trim()) errors.business_name = true;
    if (!form.phone?.trim()) errors.phone = true;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }
    setFieldErrors({});

    // Frontend: mutually exclusive flags
    if (form.force_wholesale_all_products && form.force_purchase_all_products) {
      toast.error('No es posible activar "precio mayoreo" y "precio de compra" al mismo tiempo.');
      return;
    }
    if (form.force_zero_price && (form.force_wholesale_all_products || form.force_purchase_all_products)) {
      toast.error('Precio $0 no puede combinarse con precio mayoreo o precio de compra.');
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
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, colors: ["#4F46E5", "#06B6D4", "#10B981"] });
        toast.success("✓ Cliente actualizado");
      } else {
        const response = await base44.functions.invoke('createClientSafe', { ...form, business_id: businessId });
        if (!response.data.success) {
          toast.error(`Error: ${response.data.error}`);
          setSaving(false);
          return;
        }
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, colors: ["#4F46E5", "#06B6D4", "#10B981"] });
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

  const filtered = clients
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.business_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (a.business_name || a.name).localeCompare(b.business_name || b.name, "es"));

  return (
    <Card className="border-0 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700 text-lg">Clientes</h3>
        {can('Clientes', 'create') && (
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo cliente
        </Button>
        )}
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
            <TableHead>Nombre Negocio</TableHead>
            <TableHead>Nombre Contacto</TableHead>
            <TableHead>Giro</TableHead>
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
              <TableCell className="font-medium">{c.business_name || "—"}</TableCell>
              <TableCell className="text-slate-500">{c.name}</TableCell>
              <TableCell className="text-slate-500">{c.giro || "—"}</TableCell>
              <TableCell className="text-slate-500">{c.email || "—"}</TableCell>
              <TableCell className="text-slate-500">{c.phone || "—"}</TableCell>
              <TableCell className="text-slate-500">{c.rfc || "—"}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge className={c.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                    {c.status === "active" ? <><UserCheck className="h-3 w-3 mr-1 inline" />Activo</> : <><UserX className="h-3 w-3 mr-1 inline" />Inactivo</>}
                  </Badge>
                  {c.force_zero_price && (
                    <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px] w-fit">
                      🔁 Cliente interno · $0
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">
                {can('Clientes', 'edit_name') && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                  <Pencil className="h-4 w-4 text-slate-400" />
                </Button>
                )}
                {can('Clientes', 'delete') && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c)}>
                  <Trash2 className="h-4 w-4 text-slate-400" />
                </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-slate-400 py-8">No hay clientes registrados</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[min(90dvh,700px)] sm:max-h-[min(90dvh,800px)] p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <DialogTitle>{editing ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre de Contacto *</Label>
                <Input
                  value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: false })); }}
                  className={fieldErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {fieldErrors.name && <p className="text-xs text-red-500 mt-1">Campo requerido</p>}
              </div>
              <div>
                <Label>Nombre de Negocio *</Label>
                <Input
                  value={form.business_name}
                  onChange={e => { setForm({ ...form, business_name: e.target.value }); if (fieldErrors.business_name) setFieldErrors(p => ({ ...p, business_name: false })); }}
                  className={fieldErrors.business_name ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {fieldErrors.business_name && <p className="text-xs text-red-500 mt-1">Campo requerido</p>}
              </div>
            </div>
            <div>
              <Label>Giro</Label>
              <Input value={form.giro} onChange={e => setForm({ ...form, giro: e.target.value })} placeholder="Ej. Ferretería, Restaurante, Distribuidora..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono *</Label>
              <Input
                value={form.phone}
                onChange={e => { setForm({ ...form, phone: e.target.value }); if (fieldErrors.phone) setFieldErrors(p => ({ ...p, phone: false })); }}
                className={fieldErrors.phone ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">Campo requerido</p>}
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
                  disabled={form.force_zero_price}
                  onCheckedChange={(checked) => {
                    setForm(prev => ({ ...prev, force_wholesale_all_products: !!checked, ...(checked ? { force_purchase_all_products: false } : {}) }));
                  }}
                />
                <Label htmlFor="force_wholesale" className={`text-sm leading-snug cursor-pointer ${form.force_zero_price ? "opacity-40" : ""}`}>
                  Aplicar precio mayoreo en todos los productos y en cualquier cantidad
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="force_purchase"
                  checked={form.force_purchase_all_products}
                  disabled={form.force_zero_price}
                  onCheckedChange={(checked) => {
                    setForm(prev => ({ ...prev, force_purchase_all_products: !!checked, ...(checked ? { force_wholesale_all_products: false } : {}) }));
                  }}
                />
                <Label htmlFor="force_purchase" className={`text-sm leading-snug cursor-pointer ${form.force_zero_price ? "opacity-40" : ""}`}>
                    Aplicar precio de compra en todos los productos y en cualquier cantidad
                  </Label>
                </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="force_zero_price"
                  checked={form.force_zero_price}
                  onCheckedChange={(checked) => {
                    setForm(prev => ({ ...prev, force_zero_price: !!checked, ...(checked ? { force_wholesale_all_products: false, force_purchase_all_products: false } : {}) }));
                  }}
                />
                <Label htmlFor="force_zero_price" className="text-sm leading-snug cursor-pointer">
                  Precio $0 (transferencia interna / muestra)
                </Label>
              </div>
                {form.force_zero_price && (
                  <div className="bg-orange-50 border border-orange-200 rounded p-2">
                    <p className="text-xs text-orange-700">🔁 <strong>Sin cargo:</strong> todas las ventas a este cliente serán registradas en $0. No genera movimiento en caja chica.</p>
                  </div>
                )}
                {!form.force_zero_price && (form.force_wholesale_all_products || form.force_purchase_all_products) && (
                  <p className="text-xs text-indigo-600 font-medium">
                    ⚡ {form.force_purchase_all_products ? "Precio de compra + 20 MXN transporte/producto" : "Precio mayoreo"} activo para este cliente
                  </p>
                )}
                {!form.force_zero_price && form.force_purchase_all_products && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2">
                    <p className="text-xs text-amber-700">🚚 <strong>Transporte:</strong> 20 MXN por producto</p>
                  </div>
                )}
            </div>

          </div>
          <div className="flex justify-end gap-3 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border shrink-0 bg-card">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name?.trim() || !form.business_name?.trim() || !form.phone?.trim() || saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}