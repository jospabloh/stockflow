import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useBusinessContext } from "@/components/BusinessContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowLeft, LifeBuoy, Send, Sparkles, Shield } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/PermissionContext";
import AiIntakeChat from "@/components/support/AiIntakeChat";
import { composeTicketBody } from "@/lib/aiIntake";

const STATUS_LABEL = {
  open: "Abierto", in_progress: "En proceso", waiting_customer: "Esperando tu respuesta",
  resolved: "Resuelto", closed: "Cerrado",
};
const STATUS_STYLE = {
  open: "bg-blue-100 text-blue-700", in_progress: "bg-amber-100 text-amber-700",
  waiting_customer: "bg-amber-100 text-amber-700", resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-600",
};
const CATEGORIES = [
  { v: "technical", l: "Técnico" }, { v: "billing", l: "Facturación" }, { v: "account", l: "Cuenta" },
  { v: "inventory", l: "Inventario" }, { v: "sales", l: "Ventas" },
  { v: "feature_request", l: "Solicitud de función / Mejora" }, { v: "other", l: "Otro" },
];
const SLA_NOTE = {
  feature_request: "Las solicitudes de nuevas funciones o mejoras se atienden en un plazo estimado de 3 a 5 días hábiles.",
  default: "Los incidentes y problemas se atienden en un plazo estimado de 24 a 48 horas.",
};
const PRIORITIES = [{ v: "low", l: "Baja" }, { v: "normal", l: "Normal" }, { v: "high", l: "Alta" }, { v: "urgent", l: "Urgente" }];

// Categorías donde entra el asistente BA/PO experto: solicitud de función/mejora
// (feature) e incidencias técnicas (bug). El resto conserva el flujo directo.
const AI_CATEGORY_KIND = { feature_request: "feature", technical: "bug" };

function fmt(v) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function SupportTickets() {
  const { can } = usePermissions();
  const { businessId } = useBusinessContext();
  const [tickets, setTickets] = useState(null);
  const [view, setView] = useState("list"); // 'list' | 'new' | 'thread'
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState(null);
  const [form, setForm] = useState({ subject: "", description: "", category: "technical", priority: "normal" });
  const [newStep, setNewStep] = useState("form"); // 'form' | 'ai' (dentro de la vista 'new')
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const aiKind = AI_CATEGORY_KIND[form.category] || null;


  const loadTickets = useCallback(async () => {
    if (!businessId) return;
    try {
      const rows = await base44.entities.SupportTicket.filter({ business_id: businessId }, "-last_message_at", 200);
      setTickets(rows ?? []);
    } catch (e) { toast.error(e.message); setTickets([]); }
  }, [businessId]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  async function openThread(t) {
    setActive(t); setView("thread"); setMessages(null); setReply("");
    try {
      const rows = await base44.entities.SupportTicketMessage.filter({ ticket_id: t.id }, "created_date", 200);
      setMessages(rows ?? []);
      if (t.unread_for_tenant) {
        base44.functions.invoke('business', { action: 'markSupportTicketReadSafe', ticket_id: t.id }).catch(() => {});
      }
    } catch (e) { toast.error(e.message); setMessages([]); }
  }

  // Punto de entrada del botón principal del formulario: valida y decide si
  // arranca la entrevista con el asistente (feature/incidencia) o crea directo.
  function startOrCreate() {
    if (!form.subject.trim() || !form.description.trim()) { toast.error("Asunto y descripción son obligatorios."); return; }
    if (aiKind) { setNewStep("ai"); return; }
    createTicket();
  }

  /**
   * Crea el ticket. Si viene un `brief` de la IA, el cuerpo (descripción + primer
   * mensaje) se enriquece con la especificación en Markdown vía `composeTicketBody`
   * (para que llegue a Mission Control, al owner y al correo sin depender de un
   * deploy de esquema) y se adjunta el brief estructurado en `ai_brief`.
   * @param {import('@/lib/aiIntake').IntakeBrief | null} [brief]
   */
  async function createTicket(brief) {
    if (!form.subject.trim() || !form.description.trim()) { toast.error("Asunto y descripción son obligatorios."); return; }
    setBusy(true);
    const original = form.description.trim();
    const body = brief ? composeTicketBody(original, brief) : original;
    try {
      // El servidor re-deriva negocio, autor y permiso (Centro de Soporte:create).
      const res = await base44.functions.invoke('business', {
        action: 'createSupportTicketSafe',
        subject: form.subject.trim(), description: body,
        category: form.category, priority: form.priority,
        ...(brief ? { ai_brief: brief } : {}),
      });
      const ticket = res?.data?.ticket;
      if (!ticket?.id) throw new Error(res?.data?.error || 'No se pudo crear el ticket');
      // Push en tiempo real a ACACIA Mission Control (no bloquea la UI). StockFlow
      // no puede alojar una función nueva (tope de 50 funciones de Base44), así que
      // le avisamos a Mission Control por HTTP con el id; MC lee el ticket real vía
      // el puente acaciaControl, lo refleja sin sincronizar y notifica a soporte.
      fetch('https://control.acaciaco.com.mx/api/ingest/ticket-pull', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app: 'stockflow', ticketId: ticket.id }),
      }).catch(() => {});
      toast.success("Ticket enviado. Te responderemos pronto.");
      setForm({ subject: "", description: "", category: "technical", priority: "normal" });
      setNewStep("form");
      setView("list"); await loadTickets();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function sendReply() {
    if (!reply.trim() || !active) return;
    setBusy(true);
    try {
      // El servidor relee el ticket, comprueba negocio y permiso (Centro de
      // Soporte:reply) y calcula el conteo y el estado desde la fila guardada.
      const res = await base44.functions.invoke('business', {
        action: 'replySupportTicketSafe', ticket_id: active.id, body: reply.trim(),
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'No se pudo enviar la respuesta');
      setReply("");
      await openThread({ ...active, messages_count: (active.messages_count || 0) + 1 });
      await loadTickets();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  const Badge = ({ s }) => (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s] || "bg-gray-100 text-gray-600"}`}>{STATUS_LABEL[s] || s}</span>
  );

  if (!can('Centro de Soporte', 'view')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <Shield className="h-12 w-12 text-rose-300" />
        <h2 className="text-xl font-semibold text-slate-700">Acceso Restringido</h2>
        <p className="text-slate-500 text-sm text-center">No tienes permiso para ver el centro de soporte.</p>
      </div>
    );
  }

  // ── New ticket ──
  if (view === "new") {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <button onClick={() => { if (newStep === "ai") { setNewStep("form"); } else { setView("list"); } }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</button>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <LifeBuoy className="h-5 w-5" /> {newStep === "ai" ? (aiKind === "bug" ? "Reporte de incidencia" : "Nueva funcionalidad") : "Nuevo ticket de soporte"}
        </h1>
        {newStep === "ai" && aiKind ? (
          <Card className="p-5">
            <AiIntakeChat
              kind={aiKind}
              subject={form.subject}
              description={form.description}
              saving={busy}
              onBack={() => setNewStep("form")}
              onComplete={(brief) => createTicket(brief)}
            />
          </Card>
        ) : (
          <Card className="p-5 space-y-4">
            <div><Label>Asunto</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Resumen del problema" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoría</Label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                </select>
              </div>
              <div><Label>Prioridad</Label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </div>
            </div>
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {SLA_NOTE[form.category] || SLA_NOTE.default}
            </p>
            <div><Label>Descripción</Label><Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Cuéntanos qué ocurre…" /></div>
            {aiKind && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                Un asistente experto te hará unas preguntas para dejar tu solicitud lista para el equipo.
              </p>
            )}
            <div className="flex justify-end">
              <Button onClick={startOrCreate} disabled={busy} className="gap-2">
                {aiKind ? <><Sparkles className="h-4 w-4" /> Continuar con el asistente</> : (busy ? "Enviando…" : "Enviar ticket")}
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── Thread ──
  if (view === "thread" && active) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <button onClick={() => { setView("list"); loadTickets(); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</button>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{active.subject}</h1>
          <Badge s={active.status} />
        </div>
        <Card className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
          {messages === null ? <p className="text-sm text-muted-foreground">Cargando…</p>
            : messages.length === 0 ? <p className="text-sm text-muted-foreground">Sin mensajes.</p>
            : messages.map((m) => (
              <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.author_role === "owner" ? "bg-blue-50 border border-blue-100" : "bg-muted"}`}>
                <div className="mb-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-medium">{m.author_role === "owner" ? "Soporte ACACIA" : (m.author_name || "Tú")}</span>
                  <span>{fmt(m.created_date)}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
        </Card>
        {active.status !== "closed" && can('Centro de Soporte', 'reply') && (
          <Card className="p-3">
            <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe tu respuesta…" />
            <div className="mt-2 flex justify-end"><Button onClick={sendReply} disabled={busy || !reply.trim()}><Send className="mr-1 h-4 w-4" />{busy ? "Enviando…" : "Responder"}</Button></div>
          </Card>
        )}
      </div>
    );
  }

  // ── List ──
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2"><LifeBuoy className="h-5 w-5" /> Soporte</h1>
        {can('Centro de Soporte', 'create') && (
        <Button onClick={() => { setNewStep("form"); setView("new"); }}><Plus className="mr-1 h-4 w-4" /> Nuevo ticket</Button>
        )}
      </div>
      {tickets === null ? <p className="text-sm text-muted-foreground">Cargando…</p>
        : tickets.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Aún no tienes tickets. Abre uno y nuestro equipo te responderá desde aquí.
          </Card>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <Card key={t.id} className="p-4 cursor-pointer hover:bg-muted/40" onClick={() => openThread(t)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{t.subject}</span>
                  <Badge s={t.status} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{fmt(t.last_message_at || t.created_date)}</span>
                  {t.unread_for_tenant && <span className="rounded-full bg-blue-500 px-1.5 text-[10px] text-white">nuevo</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
