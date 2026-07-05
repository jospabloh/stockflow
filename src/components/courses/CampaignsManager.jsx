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
import { Megaphone, Mail, MessageCircle, Users, Send, History } from "lucide-react";
import { toast } from "sonner";
import { waLink } from "@/lib/courseComms";
import SectionHeader from "@/components/courses/SectionHeader";

const ENROLL_STATUS = [
  { v: "", l: "Todos los inscritos" },
  { v: "confirmado", l: "Confirmados" },
  { v: "pagado", l: "Pagados" },
  { v: "asistio", l: "Asistieron" },
  { v: "interesado", l: "Interesados" },
];

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const personalize = (body, name) => String(body || "").replace(/\{\{\s*nombre\s*\}\}/gi, firstName(name) || "Hola");

function fmtDateTime(v) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const emptyForm = {
  title: "", audience_type: "contacts", tags: [], status: "active",
  course_id: "", enrollment_status: "", channel: "email", subject: "", body: "",
};

export default function CampaignsManager() {
  const { businessId, businessName } = useBusinessContext();
  const { can } = usePermissions();
  const [contacts, setContacts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [courseEnrollments, setCourseEnrollments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);

  const loadCampaigns = () => businessId
    ? base44.entities.Campaign.filter({ business_id: businessId }, "-sent_at", 100).then(setCampaigns).catch(() => setCampaigns([]))
    : Promise.resolve();

  useEffect(() => {
    if (!businessId) return;
    base44.entities.Contact.filter({ business_id: businessId }, "-created_date", 2000).then(setContacts).catch(() => setContacts([]));
    base44.entities.Course.filter({ business_id: businessId }, "-created_date", 500).then(setCourses).catch(() => setCourses([]));
    loadCampaigns();
  }, [businessId]);

  // Load enrollments when a course audience is chosen
  useEffect(() => {
    if (form.audience_type === "course" && form.course_id && businessId) {
      base44.entities.Enrollment.filter({ business_id: businessId, course_id: form.course_id }, "-created_date", 1000).then(setCourseEnrollments).catch(() => setCourseEnrollments([]));
    } else {
      setCourseEnrollments([]);
    }
  }, [form.audience_type, form.course_id, businessId]);

  const allTags = useMemo(() => {
    const s = new Set();
    contacts.forEach(c => (c.tags || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [contacts]);

  const toggleTag = (t) => setForm(f => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t] }));

  const courseTitle = useMemo(() => courses.find(c => c.id === form.course_id)?.title || "", [courses, form.course_id]);

  // Compute recipients [{ name, email, phone }]
  const recipients = useMemo(() => {
    if (form.audience_type === "course") {
      const seen = new Set();
      const out = [];
      for (const e of courseEnrollments) {
        if (form.enrollment_status && e.status !== form.enrollment_status) continue;
        if (seen.has(e.contact_id)) continue;
        seen.add(e.contact_id);
        out.push({ name: e.contact_name, email: e.contact_email, phone: e.contact_phone });
      }
      return out;
    }
    return contacts
      .filter(c => (form.status ? c.status === form.status : c.status !== "inactive"))
      .filter(c => form.tags.length === 0 || (c.tags || []).some(t => form.tags.includes(t)))
      .map(c => ({ name: c.name, email: c.email, phone: c.phone }));
  }, [form.audience_type, form.tags, form.status, form.enrollment_status, contacts, courseEnrollments]);

  const withEmail = recipients.filter(r => (r.email || "").trim());
  const withPhone = recipients.filter(r => (r.phone || "").trim());

  const audienceDesc = form.audience_type === "course"
    ? `Inscritos: ${courseTitle}${form.enrollment_status ? ` (${form.enrollment_status})` : ""}`
    : `Contactos${form.tags.length ? ` · ${form.tags.join(", ")}` : ""}`;

  const sendEmails = async () => {
    if (!form.body.trim()) { toast.error("Escribe el mensaje"); return; }
    if (withEmail.length === 0) { toast.error("No hay destinatarios con correo"); return; }
    setSending(true);
    const tid = toast.loading(`Enviando ${withEmail.length} correos…`);
    try {
      const response = await base44.functions.invoke('courseComms', {
        action: 'sendCampaignEmails',
        business_id: businessId,
        title: form.title || form.subject || "Campaña",
        audience_type: form.audience_type,
        audience_desc: audienceDesc,
        tags: form.tags,
        status: form.status,
        course_id: form.course_id,
        enrollment_status: form.enrollment_status,
        subject: form.subject,
        body: form.body,
      });
      toast.dismiss(tid);
      if (!response.data?.success) { toast.error(response.data?.error || "No se pudo enviar"); setSending(false); return; }
      const { sent, failed } = response.data;
      toast.success(`✓ ${sent} correo(s) enviado(s)${failed ? `, ${failed} fallido(s)` : ""}`);
      await loadCampaigns();
    } catch (e) {
      toast.dismiss(tid);
      toast.error(`Error: ${e.message || "No se pudo enviar"}`);
    } finally {
      setSending(false);
    }
  };

  const canSend = can('Campañas', 'send');

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Megaphone}
        title="Campañas y avisos"
        subtitle="Manda un mensaje por correo o WhatsApp a un segmento de contactos o a los inscritos de un curso."
      />
      <Card className="border-0 shadow-sm p-6">

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: compose */}
          <div className="space-y-4">
            <div>
              <Label>Nombre interno (opcional)</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej. Promo curso barista julio" />
            </div>

            <div>
              <Label>Audiencia</Label>
              <Select value={form.audience_type} onValueChange={v => setForm({ ...form, audience_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacts">Contactos (por etiqueta)</SelectItem>
                  <SelectItem value="course">Inscritos de un curso (aviso)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.audience_type === "contacts" ? (
              <div>
                <Label>Etiquetas (vacío = todos los activos)</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {allTags.length === 0 && <span className="text-xs text-slate-400">Sin etiquetas aún.</span>}
                  {allTags.map(t => (
                    <button key={t} type="button" onClick={() => toggleTag(t)}
                      className={`text-xs rounded-full border px-2 py-0.5 ${form.tags.includes(t) ? "bg-brand-600 text-white border-brand-600" : "border-border text-muted-foreground hover:bg-muted"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Curso</Label>
                  <Select value={form.course_id} onValueChange={v => setForm({ ...form, course_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un curso" /></SelectTrigger>
                    <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Filtrar por estatus</Label>
                  <Select value={form.enrollment_status || "all"} onValueChange={v => setForm({ ...form, enrollment_status: v === "all" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ENROLL_STATUS.map(s => <SelectItem key={s.v || "all"} value={s.v || "all"}>{s.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={v => setForm({ ...form, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Correo</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp (uno por uno)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.channel === "email" && (
              <div>
                <Label>Asunto</Label>
                <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Asunto del correo" />
              </div>
            )}
            <div>
              <Label>Mensaje</Label>
              <Textarea rows={6} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Escribe tu mensaje… Usa {{nombre}} para personalizar con el nombre del contacto." />
              <p className="text-xs text-muted-foreground mt-1">Tip: <code>{'{{nombre}}'}</code> se reemplaza por el nombre del contacto.</p>
            </div>
          </div>

          {/* Right: recipients + send */}
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-slate-700 flex items-center gap-2"><Users className="h-4 w-4" /> {audienceDesc}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {recipients.length} destinatario(s) · {withEmail.length} con correo · {withPhone.length} con teléfono
              </p>
            </div>

            {form.channel === "email" ? (
              <Button onClick={sendEmails} disabled={!canSend || sending || withEmail.length === 0 || !form.body.trim()} className="w-full bg-brand-600 hover:bg-brand-700">
                <Mail className="h-4 w-4 mr-1" /> {sending ? "Enviando…" : `Enviar ${withEmail.length} correo(s)`}
              </Button>
            ) : (
              <div className="rounded-lg border border-border max-h-[360px] overflow-y-auto divide-y">
                <p className="px-3 py-2 text-xs text-muted-foreground">Toca cada contacto para abrir WhatsApp con el mensaje precargado.</p>
                {withPhone.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">No hay contactos con teléfono.</p>}
                {withPhone.map((r, i) => (
                  <a key={i} href={waLink(r.phone, personalize(form.body, r.name))} target="_blank" rel="noreferrer"
                    className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-muted ${!form.body.trim() ? "pointer-events-none opacity-50" : ""}`}>
                    <span>{r.name || r.phone}<span className="text-muted-foreground"> · {r.phone}</span></span>
                    <MessageCircle className="h-4 w-4 text-green-600" />
                  </a>
                ))}
              </div>
            )}
            {!canSend && <p className="text-xs text-amber-600">No tienes permiso para enviar campañas.</p>}
          </div>
        </div>
      </Card>

      <Card className="border-0 shadow-sm p-6">
        <h3 className="font-semibold text-slate-700 text-base flex items-center gap-2 mb-3"><History className="h-4 w-4" /> Historial de campañas por correo</h3>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no has enviado campañas por correo.</p>
        ) : (
          <div className="space-y-2">
            {campaigns.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{c.title}</span>
                  <span className="block text-xs text-muted-foreground">{c.audience_desc} · {fmtDateTime(c.sent_at)}</span>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700">{c.sent_count || 0} enviados{c.failed_count ? ` · ${c.failed_count} fallidos` : ""}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
