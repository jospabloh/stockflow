import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, UserCheck, UserX, X } from "lucide-react";
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

const SOURCES = [
  { v: "instagram", l: "Instagram" },
  { v: "whatsapp", l: "WhatsApp" },
  { v: "curso", l: "Curso" },
  { v: "referido", l: "Referido" },
  { v: "cliente", l: "Cliente" },
  { v: "otro", l: "Otro" },
];
const SOURCE_LABEL = SOURCES.reduce((acc, s) => ({ ...acc, [s.v]: s.l }), {});
const TAG_SUGGESTIONS = ["matcha", "barista", "cultura cafetera", "cafetería", "mayoreo"];

const emptyForm = {
  name: "", phone: "", email: "", tags: [], source: "", status: "active",
  city: "", instagram: "", notes: "", client_id: "", client_name: "",
};

export default function ContactsManager() {
  const { businessId } = useBusinessContext();
  const { can } = usePermissions();
  const [contacts, setContacts] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const load = () => businessId
    ? base44.entities.Contact.filter({ business_id: businessId }, "-created_date").then(setContacts)
    : Promise.resolve().then(() => setContacts([]));

  useEffect(() => {
    load();
    if (businessId) {
      base44.entities.Client.filter({ business_id: businessId }, "-created_date").then(setClients).catch(() => setClients([]));
    }
  }, [businessId]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setTagInput(""); setFieldErrors({}); setFormOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || "", phone: c.phone || "", email: c.email || "",
      tags: Array.isArray(c.tags) ? c.tags : [], source: c.source || "", status: c.status || "active",
      city: c.city || "", instagram: c.instagram || "", notes: c.notes || "",
      client_id: c.client_id || "", client_name: c.client_name || "",
    });
    setTagInput(""); setFieldErrors({}); setFormOpen(true);
  };

  const addTag = (raw) => {
    const t = (raw || "").trim().toLowerCase();
    if (!t) return;
    setForm(prev => prev.tags.includes(t) ? prev : { ...prev, tags: [...prev.tags, t] });
    setTagInput("");
  };
  const removeTag = (t) => setForm(prev => ({ ...prev, tags: prev.tags.filter(x => x !== t) }));

  const handleSave = async () => {
    const errors = {};
    if (!form.name?.trim()) errors.name = true;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("El nombre del contacto es requerido");
      return;
    }
    setFieldErrors({});
    // Fold any half-typed tag into the payload
    const pendingTag = tagInput.trim().toLowerCase();
    const tags = pendingTag && !form.tags.includes(pendingTag) ? [...form.tags, pendingTag] : form.tags;

    setSaving(true);
    try {
      if (editing) {
        if (editing.business_id !== businessId) {
          toast.error("No tienes permiso para editar este contacto");
          setFormOpen(false);
          return;
        }
        const response = await base44.functions.invoke('contacts', { action: 'updateContactSafe', contact_id: editing.id, updates: { ...form, tags } });
        if (!response.data?.success) {
          toast.error(`Error: ${response.data?.error || 'No se pudo guardar'}`);
          setSaving(false);
          return;
        }
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, colors: ["#4F46E5", "#06B6D4", "#10B981"] });
        toast.success("✓ Contacto actualizado");
      } else {
        const response = await base44.functions.invoke('contacts', { action: 'createContactSafe', ...form, tags, business_id: businessId });
        if (!response.data?.success) {
          toast.error(`Error: ${response.data?.error || 'No se pudo guardar'}`);
          setSaving(false);
          return;
        }
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, colors: ["#4F46E5", "#06B6D4", "#10B981"] });
        toast.success("✓ Contacto creado");
      }
      await load();
      setFormOpen(false);
    } catch (error) {
      toast.error(`Error: ${error.message || 'No se pudo guardar el contacto'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contact) => {
    const response = await base44.functions.invoke('contacts', { action: 'deleteContactSafe', contact_id: contact.id });
    if (!response.data?.success) {
      toast.error(response.data?.error || "No se pudo eliminar el contacto");
      return;
    }
    setContacts(contacts.filter(c => c.id !== contact.id));
    toast.success("Contacto eliminado");
  };

  const filtered = contacts
    .filter(c =>
      (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

  return (
    <Card className="border-0 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-slate-700 text-lg">Contactos</h3>
        {can('Contactos', 'create') && (
          <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo contacto
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">Personas interesadas en tus cursos, campañas y avisos.</p>
      <Input
        placeholder="Buscar por nombre, email, teléfono o etiqueta..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4"
      />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Etiquetas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-slate-500">{c.phone || "—"}</TableCell>
                <TableCell className="text-slate-500">{c.email || "—"}</TableCell>
                <TableCell className="text-slate-500">{SOURCE_LABEL[c.source] || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(c.tags || []).length === 0 ? <span className="text-slate-400">—</span> :
                      (c.tags || []).map(t => (
                        <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={c.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                    {c.status === "active" ? <><UserCheck className="h-3 w-3 mr-1 inline" />Activo</> : <><UserX className="h-3 w-3 mr-1 inline" />Inactivo</>}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {can('Contactos', 'edit') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4 text-slate-400" />
                    </Button>
                  )}
                  {can('Contactos', 'delete') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c)}>
                      <Trash2 className="h-4 w-4 text-slate-400" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-400 py-8">No hay contactos registrados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[min(90dvh,700px)] sm:max-h-[min(90dvh,800px)] p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <DialogTitle>{editing ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={e => { setForm({ ...form, name: e.target.value }); if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: false })); }}
                className={fieldErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {fieldErrors.name && <p className="text-xs text-red-500 mt-1">Campo requerido</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Para WhatsApp" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origen</Label>
                <Select value={form.source || "none"} onValueChange={v => setForm({ ...form, source: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {SOURCES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ciudad</Label>
                <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="@usuario" />
              </div>
            </div>

            {/* Tags / intereses */}
            <div>
              <Label>Etiquetas / intereses</Label>
              <div className="flex flex-wrap gap-1.5 mb-2 mt-1">
                {form.tags.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1 pr-1">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} className="rounded-full hover:bg-black/10 p-0.5" aria-label={`Quitar ${t}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                placeholder="Escribe y Enter para agregar…"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TAG_SUGGESTIONS.filter(s => !form.tags.includes(s)).map(s => (
                  <button key={s} type="button" onClick={() => addTag(s)} className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:bg-muted">
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Vincular a cliente (opcional)</Label>
              <Select
                value={form.client_id || "none"}
                onValueChange={v => {
                  if (v === "none") { setForm({ ...form, client_id: "", client_name: "" }); return; }
                  const cl = clients.find(c => c.id === v);
                  setForm({ ...form, client_id: v, client_name: cl ? (cl.business_name || cl.name) : "" });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {clients.map(cl => (
                    <SelectItem key={cl.id} value={cl.id}>{cl.business_name || cl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notas</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border shrink-0 bg-card">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name?.trim() || saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
