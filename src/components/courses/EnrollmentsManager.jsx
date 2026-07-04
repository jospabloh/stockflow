import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/lib/PermissionContext";
import { useBusinessContext } from "@/components/BusinessContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Users, ClipboardList, Send, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { waLink, enrollmentWhatsAppMessage } from "@/lib/courseComms";

const STATUS = [
  { v: "interesado", l: "Interesado", c: "bg-slate-100 text-slate-600" },
  { v: "confirmado", l: "Confirmado", c: "bg-amber-100 text-amber-700" },
  { v: "pagado", l: "Pagado", c: "bg-emerald-100 text-emerald-700" },
  { v: "asistio", l: "Asistió", c: "bg-blue-100 text-blue-700" },
  { v: "no_show", l: "No asistió", c: "bg-red-100 text-red-700" },
  { v: "cancelado", l: "Cancelado", c: "bg-gray-100 text-gray-500" },
];
const STATUS_MAP = STATUS.reduce((a, s) => ({ ...a, [s.v]: s }), {});

const money = (n) => (typeof n === "number" && !Number.isNaN(n))
  ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)
  : "—";

const emptyForm = {
  course_id: "", contact_id: "", contact_label: "",
  price_option_label: "", price_amount: "", people_count: "1",
  status: "interesado", amount_paid: "", payment_method: "", notes: "",
};

export default function EnrollmentsManager() {
  const { businessId, businessName } = useBusinessContext();
  const { can } = usePermissions();
  const [enrollments, setEnrollments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [filterCourse, setFilterCourse] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [contactSearch, setContactSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => businessId
    ? base44.entities.Enrollment.filter({ business_id: businessId }, "-created_date", 500).then(setEnrollments)
    : Promise.resolve().then(() => setEnrollments([]));

  useEffect(() => {
    load();
    if (businessId) {
      base44.entities.Course.filter({ business_id: businessId }, "-created_date", 500).then(setCourses).catch(() => setCourses([]));
      base44.entities.Contact.filter({ business_id: businessId }, "-created_date", 1000).then(setContacts).catch(() => setContacts([]));
    }
  }, [businessId]);

  const courseById = useMemo(() => courses.reduce((a, c) => ({ ...a, [c.id]: c }), {}), [courses]);
  const selectedCourse = form.course_id ? courseById[form.course_id] : null;

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, course_id: filterCourse !== "all" ? filterCourse : "" });
    setContactSearch(""); setFormOpen(true);
  };
  const openEdit = (e) => {
    setEditing(e);
    setForm({
      course_id: e.course_id, contact_id: e.contact_id, contact_label: e.contact_name || "",
      price_option_label: e.price_option_label || "", price_amount: e.price_amount ?? "",
      people_count: String(e.people_count || 1), status: e.status || "interesado",
      amount_paid: e.amount_paid ?? "", payment_method: e.payment_method || "", notes: e.notes || "",
    });
    setContactSearch(""); setFormOpen(true);
  };

  const pickPriceOption = (label) => {
    const opt = (selectedCourse?.price_options || []).find(o => o.label === label);
    setForm(f => ({ ...f, price_option_label: label, price_amount: opt ? opt.amount : f.price_amount }));
  };

  const onCourseChange = (cid) => {
    const c = courseById[cid];
    const opts = c?.price_options || [];
    setForm(f => ({
      ...f, course_id: cid,
      price_option_label: opts.length === 1 ? opts[0].label : "",
      price_amount: opts.length === 1 ? opts[0].amount : "",
    }));
  };

  const buildPayload = () => ({
    price_option_label: form.price_option_label,
    price_amount: form.price_amount === "" ? null : Number(form.price_amount),
    people_count: form.people_count === "" ? 1 : Number(form.people_count),
    status: form.status,
    amount_paid: form.amount_paid === "" ? 0 : Number(form.amount_paid),
    payment_method: form.payment_method,
    notes: form.notes,
  });

  const handleSave = async () => {
    if (!editing && (!form.course_id || !form.contact_id)) {
      toast.error("Selecciona un curso y un contacto");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const response = await base44.functions.invoke('enrollments', { action: 'updateEnrollmentSafe', enrollment_id: editing.id, updates: buildPayload() });
        if (!response.data?.success) { toast.error(`Error: ${response.data?.error || 'No se pudo guardar'}`); setSaving(false); return; }
        toast.success("✓ Inscripción actualizada");
      } else {
        const response = await base44.functions.invoke('enrollments', { action: 'createEnrollmentSafe', business_id: businessId, course_id: form.course_id, contact_id: form.contact_id, ...buildPayload() });
        if (!response.data?.success) { toast.error(`Error: ${response.data?.error || 'No se pudo guardar'}`); setSaving(false); return; }
        toast.success("✓ Inscripción creada");
      }
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, colors: ["#4F46E5", "#06B6D4", "#10B981"] });
      await load();
      setFormOpen(false);
    } catch (error) {
      toast.error(`Error: ${error.message || 'No se pudo guardar'}`);
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (enrollment, status) => {
    const prev = enrollments;
    setEnrollments(rows => rows.map(r => r.id === enrollment.id ? { ...r, status } : r));
    const response = await base44.functions.invoke('enrollments', { action: 'updateEnrollmentSafe', enrollment_id: enrollment.id, updates: { status } }).catch(() => null);
    if (!response?.data?.success) { toast.error(response?.data?.error || "No se pudo actualizar el estatus"); setEnrollments(prev); }
  };

  const handleDelete = async (enrollment) => {
    const response = await base44.functions.invoke('enrollments', { action: 'deleteEnrollmentSafe', enrollment_id: enrollment.id });
    if (!response.data?.success) { toast.error(response.data?.error || "No se pudo eliminar"); return; }
    setEnrollments(enrollments.filter(e => e.id !== enrollment.id));
    toast.success("Inscripción eliminada");
  };

  const sendEmail = async (enrollment, kind) => {
    if (!enrollment.contact_email) { toast.error("El contacto no tiene correo registrado"); return; }
    const tid = toast.loading("Enviando correo…");
    const response = await base44.functions.invoke('courseComms', { action: 'sendEnrollmentEmail', enrollment_id: enrollment.id, kind }).catch(() => null);
    toast.dismiss(tid);
    if (!response?.data?.success) { toast.error(response?.data?.error || "No se pudo enviar el correo"); return; }
    toast.success(kind === 'reminder' ? "✓ Recordatorio enviado por correo" : "✓ Confirmación enviada por correo");
    const field = kind === 'reminder' ? 'reminder_sent_at' : 'confirmation_sent_at';
    setEnrollments(rows => rows.map(r => r.id === enrollment.id ? { ...r, [field]: new Date().toISOString() } : r));
  };

  const openWhatsApp = (enrollment, kind) => {
    if (!enrollment.contact_phone) { toast.error("El contacto no tiene teléfono"); return; }
    const course = courseById[enrollment.course_id];
    const msg = enrollmentWhatsAppMessage(kind, { contactName: enrollment.contact_name, courseTitle: enrollment.course_title, course, businessName });
    window.open(waLink(enrollment.contact_phone, msg), "_blank");
  };

  const filtered = enrollments
    .filter(e => filterCourse === "all" || e.course_id === filterCourse)
    .filter(e => filterStatus === "all" || e.status === filterStatus);

  // Capacity indicator for a filtered course
  const capacityInfo = useMemo(() => {
    if (filterCourse === "all") return null;
    const c = courseById[filterCourse];
    if (!c?.capacity) return null;
    const taken = enrollments
      .filter(e => e.course_id === filterCourse && e.status !== "cancelado")
      .reduce((sum, e) => sum + (Number(e.people_count) || 1), 0);
    return { taken, capacity: c.capacity };
  }, [filterCourse, enrollments, courseById]);

  const filteredContacts = contacts
    .filter(c => (c.name || "").toLowerCase().includes(contactSearch.toLowerCase()) || (c.phone || "").includes(contactSearch))
    .slice(0, 20);

  return (
    <Card className="border-0 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-slate-700 text-lg flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Inscripciones</h3>
        {can('Inscripciones', 'create') && (
          <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nueva inscripción
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">Asistentes por curso y su estatus (interesado → confirmado → pagado → asistió).</p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="min-w-[220px]">
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger><SelectValue placeholder="Curso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los cursos</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Estatus" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estatus</SelectItem>
              {STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {capacityInfo && (
          <Badge className={capacityInfo.taken >= capacityInfo.capacity ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
            <Users className="h-3 w-3 mr-1 inline" />{capacityInfo.taken} / {capacityInfo.capacity} cupo
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contacto</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Modalidad</TableHead>
              <TableHead>Pers.</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead>Pagado</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">
                  {e.contact_name || "—"}
                  {e.contact_phone && <span className="block text-xs text-slate-400">{e.contact_phone}</span>}
                </TableCell>
                <TableCell className="text-slate-500">{e.course_title || "—"}</TableCell>
                <TableCell className="text-slate-500">
                  {e.price_option_label || "—"}
                  {typeof e.price_amount === "number" && <span className="block text-xs text-slate-400">{money(e.price_amount)}</span>}
                </TableCell>
                <TableCell className="text-slate-500">{e.people_count || 1}</TableCell>
                <TableCell>
                  {can('Inscripciones', 'edit') ? (
                    <Select value={e.status} onValueChange={v => quickStatus(e, v)}>
                      <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Badge className={(STATUS_MAP[e.status] || STATUS_MAP.interesado).c}>{(STATUS_MAP[e.status] || STATUS_MAP.interesado).l}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-slate-500">{money(e.amount_paid)}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                  {can('Inscripciones', 'edit') && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Enviar confirmación / recordatorio"><Send className="h-4 w-4 text-slate-400" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Confirmación</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => sendEmail(e, 'confirmation')}><Mail className="h-4 w-4 mr-2" /> Por correo</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openWhatsApp(e, 'confirmation')}><MessageCircle className="h-4 w-4 mr-2" /> Por WhatsApp</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Recordatorio</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => sendEmail(e, 'reminder')}><Mail className="h-4 w-4 mr-2" /> Por correo</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openWhatsApp(e, 'reminder')}><MessageCircle className="h-4 w-4 mr-2" /> Por WhatsApp</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {can('Inscripciones', 'edit') && (
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => openEdit(e)}>Detalle</Button>
                  )}
                  {can('Inscripciones', 'delete') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(e)}><Trash2 className="h-4 w-4 text-slate-400" /></Button>
                  )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-slate-400 py-8">No hay inscripciones</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg flex flex-col max-h-[min(92dvh,720px)] p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <DialogTitle>{editing ? "Detalle de inscripción" : "Nueva inscripción"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {editing ? (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <p className="font-medium">{editing.contact_name}</p>
                <p className="text-muted-foreground">{editing.course_title}</p>
              </div>
            ) : (
              <>
                <div>
                  <Label>Curso *</Label>
                  <Select value={form.course_id} onValueChange={onCourseChange}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un curso" /></SelectTrigger>
                    <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contacto *</Label>
                  {form.contact_id ? (
                    <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                      <span>{form.contact_label}</span>
                      <button type="button" className="text-xs text-brand-600" onClick={() => setForm(f => ({ ...f, contact_id: "", contact_label: "" }))}>Cambiar</button>
                    </div>
                  ) : (
                    <>
                      <Input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Buscar contacto por nombre o teléfono…" />
                      <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border divide-y">
                        {filteredContacts.map(c => (
                          <button type="button" key={c.id} onClick={() => setForm(f => ({ ...f, contact_id: c.id, contact_label: c.name }))} className="block w-full text-left px-3 py-2 text-sm hover:bg-muted">
                            {c.name}{c.phone ? <span className="text-muted-foreground"> · {c.phone}</span> : ""}
                          </button>
                        ))}
                        {filteredContacts.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Sin contactos. Agrégalos en Contactos.</p>}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {(selectedCourse?.price_options?.length > 0) && !editing ? (
              <div>
                <Label>Modalidad / precio</Label>
                <Select value={form.price_option_label} onValueChange={pickPriceOption}>
                  <SelectTrigger><SelectValue placeholder="Selecciona modalidad" /></SelectTrigger>
                  <SelectContent>
                    {selectedCourse.price_options.map((o, i) => <SelectItem key={i} value={o.label || `Opción ${i + 1}`}>{o.label || `Opción ${i + 1}`} · {money(o.amount)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Modalidad</Label>
                  <Input value={form.price_option_label} onChange={e => setForm({ ...form, price_option_label: e.target.value })} placeholder="Etiqueta" />
                </div>
                <div>
                  <Label>Precio (MXN)</Label>
                  <Input type="number" min="0" value={form.price_amount} onChange={e => setForm({ ...form, price_amount: e.target.value })} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Personas</Label>
                <Input type="number" min="1" value={form.people_count} onChange={e => setForm({ ...form, people_count: e.target.value })} />
              </div>
              <div>
                <Label>Estatus</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pagado (MXN)</Label>
                <Input type="number" min="0" value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} />
              </div>
              <div>
                <Label>Forma de pago</Label>
                <Input value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} placeholder="Efectivo, transferencia…" />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border shrink-0 bg-card">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || (!editing && (!form.course_id || !form.contact_id))} className="bg-brand-600 hover:bg-brand-700">{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
