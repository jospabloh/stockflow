import React, { useState, useEffect, useMemo } from "react";
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
import { Plus, Pencil, Trash2, X, GraduationCap, CalendarDays, Clock, Users, Tag, MapPin, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import SectionHeader from "@/components/courses/SectionHeader";
import StatCard from "@/components/dashboard/StatCard";

const STATUS = [
  { v: "draft", l: "Borrador", c: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  { v: "published", l: "Publicado", c: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { v: "completed", l: "Completado", c: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { v: "cancelled", l: "Cancelado", c: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
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
const fmtShort = (d) => {
  if (!d) return "—";
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
};

const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

function nextSession(sessions) {
  const list = (sessions || []).filter((s) => s?.date).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (list.length === 0) return null;
  const t = todayStr();
  return list.find((s) => s.date >= t) || list[list.length - 1];
}

function priceLabel(opts) {
  const list = (opts || []).filter((o) => typeof o?.amount === "number");
  if (list.length === 0) return null;
  if (list.length === 1) return money(list[0].amount);
  const amounts = list.map((o) => o.amount).sort((a, b) => a - b);
  return `${money(amounts[0])} – ${money(amounts[amounts.length - 1])}`;
}

const emptyForm = {
  title: "", description: "", location: "", status: "draft",
  instructor_name: "", instructor_note: "", capacity: "", extra_person_price: "",
  topics: [], includes: [], price_options: [], sessions: [], flyer_url: "", notes: "",
};

// Editor reutilizable de listas de texto (temario, incluye)
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
        <Input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} />
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

  const setPrice = (i, key, value) => setForm((f) => ({ ...f, price_options: f.price_options.map((p, idx) => idx === i ? { ...p, [key]: value } : p) }));
  const addPrice = () => setForm((f) => ({ ...f, price_options: [...f.price_options, { label: "", amount: 0 }] }));
  const removePrice = (i) => setForm((f) => ({ ...f, price_options: f.price_options.filter((_, idx) => idx !== i) }));

  const setSession = (i, key, value) => setForm((f) => ({ ...f, sessions: f.sessions.map((s, idx) => idx === i ? { ...s, [key]: value } : s) }));
  const addSession = () => setForm((f) => ({ ...f, sessions: [...f.sessions, { date: "", start_time: "", end_time: "", note: "" }] }));
  const removeSession = (i) => setForm((f) => ({ ...f, sessions: f.sessions.filter((_, idx) => idx !== i) }));

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
      .filter((p) => (p.label || "").trim() || p.amount)
      .map((p) => ({ label: (p.label || "").trim(), amount: Number(p.amount) || 0 })),
    sessions: form.sessions
      .filter((s) => s.date)
      .map((s) => ({ date: s.date, start_time: s.start_time || "", end_time: s.end_time || "", note: (s.note || "").trim() })),
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
    setCourses(courses.filter((c) => c.id !== course.id));
    toast.success("Curso eliminado");
  };

  const filtered = courses
    .filter((c) => (c.title || "").toLowerCase().includes(search.toLowerCase()) || (c.instructor_name || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "es"));

  const stats = useMemo(() => {
    const total = courses.length;
    const published = courses.filter((c) => c.status === "published").length;
    const t = todayStr();
    let next = null;
    for (const c of courses) {
      if (c.status === "cancelled") continue;
      for (const s of (c.sessions || [])) {
        if (s?.date && s.date >= t && (!next || s.date < next)) next = s.date;
      }
    }
    return { total, published, next };
  }, [courses]);

  return (
    <div>
      <SectionHeader
        icon={GraduationCap}
        title="Cursos"
        subtitle="Tus cursos y talleres, con sus sesiones, precios y cupo."
        action={can('Cursos', 'create') && (
          <Button className="bg-brand-600 hover:bg-brand-700" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" /> Nuevo curso
          </Button>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <StatCard title="Cursos" value={String(stats.total)} subtitle="en total" icon={GraduationCap} color="indigo" />
        <StatCard title="Publicados" value={String(stats.published)} subtitle="visibles" icon={CheckCircle2} color="emerald" />
        <StatCard title="Próxima sesión" value={fmtShort(stats.next)} subtitle={stats.next ? "agenda" : "sin agendar"} icon={CalendarDays} color="cyan" />
      </div>

      <Input placeholder="Buscar por curso o instructor…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-md" />

      {filtered.length === 0 ? (
        <Card className="border-dashed shadow-none p-10 text-center">
          <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="font-medium text-foreground">Aún no tienes cursos</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Crea tu primer curso o taller con sus sesiones y precios.</p>
          {can('Cursos', 'create') && <Button className="bg-brand-600 hover:bg-brand-700" onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> Nuevo curso</Button>}
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const ns = nextSession(c.sessions);
            const st = STATUS_MAP[c.status] || STATUS_MAP.draft;
            const price = priceLabel(c.price_options);
            return (
              <Card key={c.id} className="group relative overflow-hidden shadow-sm hover:shadow-md hover:border-brand-500/30 transition-all duration-300 flex flex-col">
                <div className="h-1 bg-gradient-to-r from-brand-500 to-accent-500" />
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground leading-snug">{c.title}</h3>
                      {c.instructor_name && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {c.instructor_name}{c.instructor_note ? ` · ${c.instructor_note}` : ""}
                        </p>
                      )}
                    </div>
                    <Badge className={`${st.c} border-0 shrink-0`}>{st.l}</Badge>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <CalendarDays className="h-4 w-4 text-brand-600 shrink-0" />
                    {ns ? (
                      <span className="text-foreground font-medium">{fmtDate(ns.date)}{ns.start_time ? ` · ${ns.start_time}` : ""}</span>
                    ) : (
                      <span className="text-muted-foreground">Sin sesión programada</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {price && (
                      <span className="inline-flex items-center rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 px-2.5 py-0.5 text-xs font-semibold">{price}</span>
                    )}
                    {c.capacity ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {c.capacity} lugares</span>
                    ) : null}
                    {(c.topics || []).length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"><Tag className="h-3 w-3" /> {c.topics.length} temas</span>
                    )}
                    {c.location && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {c.location}</span>
                    )}
                  </div>

                  <div className="mt-auto pt-4 flex justify-end gap-1">
                    {can('Cursos', 'edit') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} aria-label="Editar curso"><Pencil className="h-4 w-4 text-slate-400" /></Button>
                    )}
                    {can('Cursos', 'delete') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c)} aria-label="Eliminar curso"><Trash2 className="h-4 w-4 text-slate-400" /></Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[min(92dvh,760px)] p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <DialogTitle>{editing ? "Editar Curso" : "Nuevo Curso"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <Label>Nombre del curso *</Label>
              <Input value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); if (nameError) setNameError(false); }} className={nameError ? "border-red-500 focus-visible:ring-red-500" : ""} placeholder="Ej. Curso para Barista" />
              {nameError && <p className="text-xs text-red-500 mt-1">Campo requerido</p>}
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Módulo teórico-práctico…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ubicación / modalidad</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ej. Baristop / En tu cafetería" />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Instructor</Label>
                <Input value={form.instructor_name} onChange={(e) => setForm({ ...form, instructor_name: e.target.value })} placeholder="Nombre" />
              </div>
              <div>
                <Label>Marca / invitado</Label>
                <Input value={form.instructor_note} onChange={(e) => setForm({ ...form, instructor_note: e.target.value })} placeholder="Ej. Prado Café" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cupo máximo</Label>
                <Input type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Ej. 4" />
              </div>
              <div>
                <Label>Precio persona extra (MXN)</Label>
                <Input type="number" min="0" value={form.extra_person_price} onChange={(e) => setForm({ ...form, extra_person_price: e.target.value })} placeholder="Ej. 500" />
              </div>
            </div>

            <div>
              <Label>Temario</Label>
              <StringListEditor items={form.topics} onChange={(topics) => setForm((f) => ({ ...f, topics }))} placeholder="Ej. Métodos de extracción" />
            </div>

            <div>
              <Label>Incluye</Label>
              <StringListEditor items={form.includes} onChange={(includes) => setForm((f) => ({ ...f, includes }))} placeholder="Ej. Manual y libreta" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Precios</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPrice}><Plus className="h-3.5 w-3.5 mr-1" /> Opción</Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Una opción = precio único. Dos o más = por modalidad (ej. en tu cafetería / en la nuestra).</p>
              <div className="space-y-2">
                {form.price_options.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={p.label} onChange={(e) => setPrice(i, "label", e.target.value)} placeholder="Etiqueta (ej. En nuestra cafetería)" className="flex-1" />
                    <Input type="number" min="0" value={p.amount} onChange={(e) => setPrice(i, "amount", e.target.value)} placeholder="MXN" className="w-28" />
                    <button type="button" onClick={() => removePrice(i)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                {form.price_options.length === 0 && <p className="text-xs text-slate-400">Sin precios. Agrega al menos uno.</p>}
              </div>
            </div>

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
                      <Input type="date" value={s.date} onChange={(e) => setSession(i, "date", e.target.value)} className="flex-1" />
                      <button type="button" onClick={() => removeSession(i)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 flex-1"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><Input type="time" value={s.start_time} onChange={(e) => setSession(i, "start_time", e.target.value)} /></div>
                      <span className="text-muted-foreground text-sm">a</span>
                      <Input type="time" value={s.end_time} onChange={(e) => setSession(i, "end_time", e.target.value)} className="flex-1" />
                    </div>
                    <Input value={s.note} onChange={(e) => setSession(i, "note", e.target.value)} placeholder="Nota (ej. Sábado · Módulo 1)" />
                  </div>
                ))}
                {form.sessions.length === 0 && <p className="text-xs text-slate-400">Sin sesiones programadas.</p>}
              </div>
            </div>

            <div>
              <Label>URL del flyer (opcional)</Label>
              <Input value={form.flyer_url} onChange={(e) => setForm({ ...form, flyer_url: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <Label>Notas internas</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border shrink-0 bg-card">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title.trim() || saving} className="bg-brand-600 hover:bg-brand-700">{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
