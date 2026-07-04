// Plantillas de correo para comunicaciones de cursos (confirmación, recordatorio, campaña).
// El encabezado usa el nombre del negocio (tenant), no "StockFlow": es comunicación del
// negocio hacia sus asistentes.

const BRAND = '#4F46E5';

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
  ));
}

export function fmtDateEs(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch (_) {
    return dateStr;
  }
}

// Próxima sesión (fecha >= hoy) o la más próxima; devuelve null si no hay.
export function nextSession(course: any): any {
  const list = ((course?.sessions) || []).filter((s: any) => s?.date).slice().sort((a: any, b: any) => a.date.localeCompare(b.date));
  if (list.length === 0) return null;
  const now = new Date();
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  return list.find((s: any) => s.date >= today) || list[list.length - 1];
}

export function sessionText(course: any): string {
  const s = nextSession(course);
  if (!s) return '';
  const parts = [fmtDateEs(s.date)];
  if (s.start_time) parts.push(s.end_time ? `${s.start_time}–${s.end_time}` : s.start_time);
  if (course?.location) parts.push(course.location);
  return parts.filter(Boolean).join(' · ');
}

export function wrap(businessName: string, bodyHtml: string): string {
  const name = esc(businessName || 'Cursos');
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f4f4f5;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:${BRAND};padding:20px 24px">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">${name}</h1>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">Cursos y talleres</p>
    </div>
    <div style="padding:28px 24px">
      ${bodyHtml}
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center">
      <p style="margin:0;font-size:11px;color:#9ca3af">Enviado por ${name}</p>
    </div>
  </div>
</body>
</html>`;
}

function detailsBlock(course: any): string {
  const st = sessionText(course);
  const rows: string[] = [];
  if (st) rows.push(`<tr><td style="padding:4px 0;color:#6b7280">📅 Sesión</td><td style="padding:4px 0;color:#111827;font-weight:600">${esc(st)}</td></tr>`);
  if (course?.location) rows.push(`<tr><td style="padding:4px 0;color:#6b7280">📍 Lugar</td><td style="padding:4px 0;color:#111827">${esc(course.location)}</td></tr>`);
  if (course?.instructor_name) rows.push(`<tr><td style="padding:4px 0;color:#6b7280">👤 Instructor</td><td style="padding:4px 0;color:#111827">${esc(course.instructor_name)}</td></tr>`);
  if (rows.length === 0) return '';
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">${rows.join('')}</table>`;
}

export function confirmationEmail(ctx: { businessName: string; contactName: string; course: any }): { subject: string; html: string } {
  const { businessName, contactName, course } = ctx;
  const greet = esc((contactName || '').split(/\s+/)[0] || 'Hola');
  const title = esc(course?.title || 'tu curso');
  const body = `
    <h2 style="color:#111827;margin-top:0">¡Tu lugar está confirmado, ${greet}! 🎉</h2>
    <p style="color:#374151;line-height:1.6">Te confirmamos tu inscripción a <strong>${title}</strong>. ¡Te esperamos!</p>
    ${detailsBlock(course)}
    <p style="color:#374151;line-height:1.6">Si tienes cualquier duda, responde a este correo o escríbenos por WhatsApp.</p>
  `;
  return { subject: `Confirmación: ${course?.title || 'tu curso'}`, html: wrap(businessName, body) };
}

export function reminderEmail(ctx: { businessName: string; contactName: string; course: any }): { subject: string; html: string } {
  const { businessName, contactName, course } = ctx;
  const greet = esc((contactName || '').split(/\s+/)[0] || 'Hola');
  const title = esc(course?.title || 'tu curso');
  const body = `
    <h2 style="color:#111827;margin-top:0">Recordatorio: ${title} 📌</h2>
    <p style="color:#374151;line-height:1.6">Hola ${greet}, te recordamos tu próxima sesión. ¡No faltes!</p>
    ${detailsBlock(course)}
    <p style="color:#374151;line-height:1.6">Si necesitas reprogramar, avísanos lo antes posible.</p>
  `;
  return { subject: `Recordatorio: ${course?.title || 'tu curso'}`, html: wrap(businessName, body) };
}

// Campaña / aviso con cuerpo libre (soporta el token {{nombre}}).
export function campaignEmail(ctx: { businessName: string; contactName: string; subject: string; body: string }): { subject: string; html: string } {
  const { businessName, contactName, subject, body } = ctx;
  const name = (contactName || '').trim();
  const personalized = String(body || '').replace(/\{\{\s*nombre\s*\}\}/gi, name || 'Hola');
  const htmlBody = esc(personalized).replace(/\n/g, '<br>');
  return { subject: subject || `Mensaje de ${businessName}`, html: wrap(businessName, `<div style="color:#374151;line-height:1.6;font-size:15px">${htmlBody}</div>`) };
}
