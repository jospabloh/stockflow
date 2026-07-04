import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { useBusinessContext } from "@/components/BusinessContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, X, GraduationCap, CalendarDays, Clock } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

const STATUS = [
  { v: "draft", l: "Borrador", c: "bg-slate-100 text-slate-600" },
  { v: "published", l: "Publicado", c: "bg-green-100 text-green-700" },
  { v: "completed", l: "Completado", c: "bg-blue-100 text-blue-700" },
  { v: "cancelled", l: "Cancelado", c: "bg-red-100 text-red-700" },
];
const STATUS_MAP = STATUS.reduce((a, s) => ({ ...a, [s.v]: s }), {});

const money = (n) => (typeof n === "number" && !Number.isNaN(n))
  ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)
  : "";

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
};

const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

// Next upcoming session date (>= today), else the earliest session, else null
function nextSession(sessions) {
  const list = (sessions || []).filter(s => s?.date).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (list.length === 0) return null;
  const t = todayStr();
  return list.find(s => s.date >= t) || list[list.length - 1];
}

function priceLabel(opts) {
  const list = (opts || []).filter(o => typeof o?.amount === "number");
  if (list.length === 0) return "—";
  if (list.length === 1) return money(list[0].amount);
  const amounts = list.map(o => o.amount).sort((a, b) => a - b);
  return `${money(amounts[0])} – ${money(amounts[amounts.length - 1])}`;
}

const emptyForm = {
  title: "", description: "", location: "", status: "draft",
  instructor_name: "", instructor_note: "", capacity: "", extra_person_price: "",
  topics: [], includes: [], price_options: [], sessions: [], flyer_url: "", notes: "",
};

// ── Small reusable list editor for arrays of strings ──
function StringListEditor({ items, onChange, placeholder }) {
  const [val, setVal] = useState("");
  const add = () => { const t = val.trim(); if (!t) return; onChange([...(items || []), t]); setVal(""); };
  return (
    <div>
      <div className="flex flex-col gap-1 mb-2">
        {(items || []).map((it, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-sm">
            <span className="flex-1">{it}</span>
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} />
        <Button type="button" variant="outline" size="sm" onClick={add}>Agregar</Button>
      </div>
    </div>
  );
}

export default function CoursesManager() {
  const { businessId } = useBusinessContext();
  const { can } = usePermissions();
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState(false);

  const load = () => businessId
    ? base44.entities.Course.filter({ business_id: businessId }, "-created_date").then(setCourses)
    : Promise.resolve().then(() => setCourses([]));

  useEffect(() => { load(); }, [businessId]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setNameError(false); setFormOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      title: c.title || "", description: c.description || "", location: c.location || "", status: c.status || "draft",
      instructor_name: c.instructor_name || "", instructor_note: c.instructor_note || "",
      capacity: c.capacity ?? "", extra_person_price: c.extra_person_price ?? "",
      topics: c.topics || [], includes: c.includes || [],
      price_options: c.price_options || [], sessions: c.sessions || [],
      flyer_url: c.flyer_url || "", notes: c.notes || "",
    });
    setNameError(false); setFormOpen(true);
  };

  // Price options editing
  const setPrice = (i, key, value) => setForm(f => ({ ...f, price_options: f.price_options.map((p, idx) => idx === i ? { ...p, [key]: value } : p) }));
  const addPrice = () => setForm(f => ({ ...f, price_options: [...f.price_options, { label: "", amount: 0 }] }));
  const removePrice = (i) => setForm(f => ({ ...f, price_options: f.price_options.filter((_, idx) => idx !== i) }));

  // Sessions editing
  const setSession = (i, key, value) => setForm(f => ({ ...f, sessions: f.sessions.map((s, idx) => idx === i ? { ...s, [key]: value } : s) }));
  const addSession = () => setForm(f => ({ ...f, sessions: [...f.sessions, { date: "", start_time: "", end_time: "", note: "" }] }));
  const removeSession = (i) => setForm(f => ({ ...f, sessions: f.sessions.filter((_, idx) => idx !== i) }));

  const buildPayload = () => ({
    title: form.title.trim(),
    description: form.description,
    location: form.location,
    status: form.status,
    instructor_name: form.instructor_name,
    instructor_note: form.instructor_note,
    capacity: form.capacity === "" ? null : Number(form.capacity),
    extra_person_price: form.extra_person_price === "" ? null : Number(form.extra_person_price),
    topics: form.topics,
    includes: form.includes,
    price_options: form.price_options
      .filter(p => (p.label || "").trim() || p.amount)
      .map(p => ({ label: (p.label || "").trim(), amount: Number(p.amount) || 0 })),
    sessions: form.sessions
      .filter(s => s.date)
      .map(s => ({ date: s.date, start_time: s.start_time || "", end_time: s.end_time || "", note: (s.note || "").trim() })),
    flyer_url: form.flyer_url,
    notes: form.notes,
  });

  const handleSave = async () => {
    if (!form.title.trim()) { setNameError(true); toast.error("El nombre del curso es requerido"); return; }
    setNameError(false);
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        if (editing.business_id !== businessId) { toast.error("No tienes permiso para editar este curso"); setFormOpen(false); return; }
        const response = await base44.functions.invoke('courses', { action: 'updateCourseSafe', course_id: editing.id, updates: payload });
        if (!response.data?.success) { toast.error(`Error: ${response.data?.error || 'No se pudo guardar'}`); setSaving(false); return; }
        toast.success("✓ Curso actualizado");
      } else {
        const response = await base44.functions.invoke('courses', { action: 'createCourseSafe', ...payload, business_id: businessId });
        if (!response.data?.success) { toast.error(`Error: ${response.data?.error || 'No se pudo guardar'}`); setSaving(false); return; }
        toast.success("✓ Curso creado");
      }
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, colors: ["#4F46E5", "#06B6D4", "#10B981"] });
      await load();
      setFormOpen(false);
    } catch (error) {
      toast.error(`Error: ${error.message || 'No se pudo guardar el curso'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (course) => {
    const response = await base44.functions.invoke('courses', { action: 'deleteCourseSafe', course_id: course.id });
    if (!response.data?.success) { toast.error(response.data?.error || "No se pudo eliminar el curso"); return; }
    setCourses(courses.filter(c => c.id !== course.id));
    toast.success("Curso eliminado");
  };

  const filtered = courses
    .filter(c => (c.title || "").toLowerCase().includes(search.toLowerCase()) || (c.instructor_name || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "es"));

  return (
    <Card className="border-0 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-slate-700 text-lg flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Cursos</h3>
        {can('Cursos', 'create') && (
          <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo curso
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">Tus cursos y talleres, con sus sesiones, precios y cupo.</p>
      <Input placeholder="Buscar por curso o instructor..." value={search} onChange={e => setSearch(e.target.value)} className="mb-4" />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Próxima sesión</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Cupo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => {
              const ns = nextSession(c.sessions);
              const st = STATUS_MAP[c.status] || STATUS_MAP.draft;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.title}
                    {c.instructor_name && <span className="block text-xs text-slate-400">{c.instructor_name}{c.instructor_note ? ` · ${c.instructor_note}` : ""}</span>}
                  </TableCell>
                  <TableCell className="text-slate-500">{ns ? `${fmtDate(ns.date)}${ns.start_time ? ` · ${ns.start_time}` : ""}` : "—"}</TableCell>
                  <TableCell className="text-slate-500">{priceLabel(c.price_options)}</TableCell>
                  <TableCell className="text-slate-500">{c.capacity ? `${c.capacity}` : "—"}</TableCell>
                  <TableCell><Badge className={st.c}>{st.l}</Badge></TableCell>
                  <TableCell className="text-center">
                    {can('Cursos', 'edit') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4 text-slate-400" /></Button>
                    )}
                    {can('Cursos', 'delete') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c)}><Trash2 className="h-4 w-4 text-slate-400" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">No hay cursos registrados</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[min(92dvh,760px)] p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <DialogTitle>{editing ? "Editar Curso" : "Nuevo Curso"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <Label>Nombre del curso *</Label>
              <Input value={form.title} onChange={e => { setForm({ ...form, title: e.target.value }); if (nameError) setNameError(false); }} className={nameError ? "border-red-500 focus-visible:ring-red-500" : ""} placeholder="Ej. Curso para Barista" />
              {nameError && <p className="text-xs text-red-500 mt-1">Campo requerido</p>}
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Módulo teórico-práctico…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ubicación / modalidad</Label>
                <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Ej. Baristop / En tu cafetería" />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Instructor</Label>
                <Input value={form.instructor_name} onChange={e => setForm({ ...form, instructor_name: e.target.value })} placeholder="Nombre" />
              </div>
              <div>
                <Label>Marca / invitado</Label>
                <Input value={form.instructor_note} onChange={e => setForm({ ...form, instructor_note: e.target.value })} placeholder="Ej. Prado Café" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cupo máximo</Label>
                <Input type="number" min="0" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} placeholder="Ej. 4" />
              </div>
              <div>
                <Label>Precio persona extra (MXN)</Label>
                <Input type="number" min="0" value={form.extra_person_price} onChange={e => setForm({ ...form, extra_person_price: e.target.value })} placeholder="Ej. 500" />
              </div>
            </div>

            <div>
              <Label>Temario</Label>
              <StringListEditor items={form.topics} onChange={topics => setForm(f => ({ ...f, topics }))} placeholder="Ej. Métodos de extracción" />
            </div>

            <div>
              <Label>Incluye</Label>
              <StringListEditor items={form.includes} onChange={includes => setForm(f => ({ ...f, includes }))} placeholder="Ej. Manual y libreta" />
            </div>

            {/* Precios por modalidad */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Precios</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPrice}><Plus className="h-3.5 w-3.5 mr-1" /> Opción</Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Una opción = precio único. Dos o más = por modalidad (ej. en tu cafetería / en la nuestra).</p>
              <div className="space-y-2">
                {form.price_options.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={p.label} onChange={e => setPrice(i, "label", e.target.value)} placeholder="Etiqueta (ej. En nuestra cafetería)" className="flex-1" />
                    <Input type="number" min="0" value={p.amount} onChange={e => setPrice(i, "amount", e.target.value)} placeholder="MXN" className="w-28" />
                    <button type="button" onClick={() => removePrice(i)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                {form.price_options.length === 0 && <p className="text-xs text-slate-400">Sin precios. Agrega al menos uno.</p>}
              </div>
            </div>

            {/* Sesiones */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Sesiones</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSession}><Plus className="h-3.5 w-3.5 mr-1" /> Sesión</Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Una o varias fechas. Aparecerán en el calendario.</p>
              <div className="space-y-2">
                {form.sessions.map((s, i) => (
                  <div key={i} className="rounded-md border border-border p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input type="date" value={s.date} onChange={e => setSession(i, "date", e.target.value)} className="flex-1" />
                      <button type="button" onClick={() => removeSession(i)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 flex-1"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><Input type="time" value={s.start_time} onChange={e => setSession(i, "start_time", e.target.value)} /></div>
                      <span className="text-muted-foreground text-sm">a</span>
                      <Input type="time" value={s.end_time} onChange={e => setSession(i, "end_time", e.target.value)} className="flex-1" />
                    </div>
                    <Input value={s.note} onChange={e => setSession(i, "note", e.target.value)} placeholder="Nota (ej. Sábado · Módulo 1)" />
                  </div>
                ))}
                {form.sessions.length === 0 && <p className="text-xs text-slate-400">Sin sesiones programadas.</p>}
              </div>
            </div>

            <div>
              <Label>URL del flyer (opcional)</Label>
              <Input value={form.flyer_url} onChange={e => setForm({ ...form, flyer_url: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <Label>Notas internas</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border shrink-0 bg-card">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title.trim() || saving} className="bg-brand-600 hover:bg-brand-700">{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
