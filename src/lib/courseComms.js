// Helpers de comunicación de cursos: link de WhatsApp (sin API) y mensajes precargados.

// Normaliza un teléfono a dígitos con lada. Default México (+52) si son 10 dígitos.
export function normalizePhone(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) d = "52" + d;          // MX sin lada país
  if (d.length === 12 && d.startsWith("52")) return d;
  return d;                                     // ya trae lada país u otro formato
}

// Link wa.me con mensaje precargado. Abre WhatsApp (app o web) con el chat del contacto.
export function waLink(phone, text) {
  const d = normalizePhone(phone);
  const t = encodeURIComponent(text || "");
  return d ? `https://wa.me/${d}?text=${t}` : `https://wa.me/?text=${t}`;
}

const pad = (n) => String(n).padStart(2, "0");
function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}
function fmtDateEs(dateStr) {
  if (!dateStr) return "";
  const dt = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? dateStr : dt.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

// Próxima sesión (>= hoy) o la más próxima.
export function nextSession(course) {
  const list = ((course?.sessions) || []).filter((s) => s?.date).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (list.length === 0) return null;
  const t = todayStr();
  return list.find((s) => s.date >= t) || list[list.length - 1];
}

export function sessionText(course) {
  const s = nextSession(course);
  if (!s) return "";
  const parts = [fmtDateEs(s.date)];
  if (s.start_time) parts.push(s.end_time ? `${s.start_time}–${s.end_time}` : s.start_time);
  if (course?.location) parts.push(course.location);
  return parts.filter(Boolean).join(" · ");
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

// Mensaje de WhatsApp precargado para una inscripción.
// kind: 'confirmation' | 'reminder'
export function enrollmentWhatsAppMessage(kind, { contactName, courseTitle, course, businessName }) {
  const greet = firstName(contactName) || "Hola";
  const st = course ? sessionText(course) : "";
  const when = st ? `\n📅 ${st}` : "";
  const from = businessName ? `\n\n— ${businessName}` : "";
  if (kind === "reminder") {
    return `¡Hola ${greet}! 📌 Te recordamos tu curso "${courseTitle}".${when}\n¡No faltes!${from}`;
  }
  return `¡Hola ${greet}! 🎉 Te confirmamos tu lugar en "${courseTitle}".${when}\n¡Te esperamos!${from}`;
}
