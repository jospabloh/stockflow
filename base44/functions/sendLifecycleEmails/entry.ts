import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');
const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') || Deno.env.get('PLATFORM_OWNER_EMAIL') || '';
const APP_NAME = 'StockFlow';
const BRAND_COLOR = '#4F46E5';
const UPGRADE_URL = 'https://www.acaciaco.com.mx/stockflow';
const MAX_RETRIES = 3;
const WHATSAPP_URL = 'https://wa.me/524498958291';
const WHATSAPP_DISPLAY = '449 895 8291';
const DAY_MS = 86_400_000;
// Mexico (Zona Centro) is a fixed UTC-6 year-round since 2022 — calendar days
// for the trial countdown are counted in the customer's local date.
const MX_OFFSET_MS = 6 * 60 * 60 * 1000;

const PLAN_LABELS = {
  start: 'Start',
  growth: 'Growth',
  pro: 'Pro',
  founder: 'Founder',
};

function planLabel(licensePlan) {
  if (!licensePlan) return '';
  return PLAN_LABELS[licensePlan] || licensePlan;
}

function firstName(fullName) {
  if (!fullName) return '';
  return String(fullName).trim().split(/\s+/)[0] || '';
}

function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City',
    });
  } catch (_) {
    return isoString;
  }
}

function wrap(bodyHtml, appUrl) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f4f4f5;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:${BRAND_COLOR};padding:20px 24px">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">${APP_NAME}</h1>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">Sistema de Inventario</p>
    </div>
    <div style="padding:28px 24px">
      ${bodyHtml}
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center">
      <p style="margin:0;font-size:12px;color:#6b7280">¿Necesitas ayuda? Escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
      <p style="margin:6px 0 0;font-size:11px;color:#9ca3af">© 2026 ${APP_NAME} — <a href="${appUrl}" style="color:${BRAND_COLOR}">Ir a la app</a></p>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(label, url) {
  return `<div style="text-align:center;margin:24px 0">
    <a href="${url}" style="background:${BRAND_COLOR};color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">${label}</a>
  </div>`;
}

// Payment instructions for every trial email. Activation is manual: the
// platform owner validates the payment (Mercado Pago or bank transfer) and
// activates the license from Mission Control. Deliberately no seat counts
// here — the plan limits are defined on the public pricing page.
function howToPay() {
  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:20px 0">
    <p style="margin:0 0 8px;color:#111827;font-weight:700">Cómo activar tu licencia</p>
    <p style="margin:0 0 8px;color:#374151;line-height:1.6">Planes: <strong>Start</strong> $799 · <strong>Growth</strong> $1,499 · <strong>Pro</strong> $2,299 MXN/mes. Detalle en <a href="${UPGRADE_URL}" style="color:${BRAND_COLOR}">acaciaco.com.mx/stockflow</a>.</p>
    <ol style="margin:0 0 8px;padding-left:20px;color:#374151;line-height:1.6">
      <li><strong>Mercado Pago:</strong> suscríbete al plan desde el botón «Suscribirse» de la página de planes.</li>
      <li><strong>Transferencia:</strong> escríbenos por WhatsApp al <a href="${WHATSAPP_URL}" style="color:${BRAND_COLOR}">${WHATSAPP_DISPLAY}</a> y te compartimos los datos bancarios.</li>
    </ol>
    <p style="margin:0;color:#374151;line-height:1.6">Envíanos tu comprobante por WhatsApp. En cuanto validemos el pago activamos tu licencia y te llega un correo de confirmación.</p>
  </div>`;
}

// Business/recipient names are tenant-controlled: escape before HTML interpolation.
function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getEmailTemplate(emailType, ctx) {
  const { businessName, recipientName, licensePlan, appUrl, upgradeUrl, licenseExpiresAt, scheduledDeleteAt, trialEndAt } = ctx;
  const name = escapeHtml(businessName || 'tu negocio');
  const greetName = escapeHtml(firstName(recipientName)) || name;
  const planName = planLabel(licensePlan);

  switch (emailType) {
    case 'trial_welcome':
      return {
        subject: `Bienvenido a ${APP_NAME} — Tu prueba gratuita de 30 días ha comenzado`,
        html: wrap(`
          <h2 style="color:#111827;margin-top:0">¡Bienvenido a ${APP_NAME}, ${greetName}!</h2>
          <p style="color:#374151;line-height:1.6">Tu período de prueba gratuita de <strong>30 días naturales</strong> para <strong>${name}</strong> ha comenzado. Durante este tiempo tienes acceso completo a todas las funciones de ${APP_NAME}.</p>
          <p style="color:#374151;line-height:1.6">Tu prueba termina el <strong>${formatDate(trialEndAt)}</strong>. Te avisaremos antes del vencimiento. Si al terminar no se ha activado la licencia, la cuenta pasa a <strong>modo solo lectura</strong>: tu información se conserva y puedes consultarla, pero no registrar operaciones nuevas.</p>
          ${howToPay()}
          ${ctaButton('Ir a mi cuenta', appUrl)}
        `, appUrl),
      };

    case 'trial_day_15':
      return {
        subject: `15 días con ${APP_NAME} — ¿Cómo va tu experiencia?`,
        html: wrap(`
          <h2 style="color:#111827;margin-top:0">Ya llevas 15 días con ${APP_NAME}</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${greetName}. Esperamos que ${APP_NAME} esté ayudando a ${name}. Tu prueba gratuita termina el <strong>${formatDate(trialEndAt)}</strong>.</p>
          <p style="color:#374151;line-height:1.6">Si necesitas ayuda o tienes preguntas, estamos aquí para apoyarte.</p>
          ${howToPay()}
        `, appUrl),
      };

    case 'trial_day_25':
      return {
        subject: `Tu prueba de ${APP_NAME} termina en 5 días`,
        html: wrap(`
          <h2 style="color:#d97706;margin-top:0">⏰ Quedan 5 días de prueba</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${greetName}. La prueba gratuita de ${name} termina el <strong>${formatDate(trialEndAt)}</strong>. Para seguir usando ${APP_NAME} sin interrupciones, activa tu licencia.</p>
          ${howToPay()}
        `, appUrl),
      };

    case 'trial_day_28':
      return {
        subject: `Quedan solo 2 días de prueba en ${APP_NAME}`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">🚨 Último aviso: 2 días restantes</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${greetName}. La prueba de ${name} termina el <strong>${formatDate(trialEndAt)}</strong>. Si no activas tu licencia, tu cuenta entrará en modo de solo lectura y no podrás registrar nuevas operaciones.</p>
          ${howToPay()}
        `, appUrl),
      };

    case 'trial_day_30':
      return {
        subject: `Hoy es el último día de tu prueba en ${APP_NAME}`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">🔴 Último día de prueba</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${greetName}. Hoy termina el período de prueba gratuita de ${name}. Después de hoy, tu cuenta pasará a modo de solo lectura; tu información se conserva.</p>
          ${howToPay()}
        `, appUrl),
      };

    case 'trial_expired':
      return {
        subject: `Tu prueba de ${APP_NAME} ha expirado — Activa tu licencia`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">Tu período de prueba ha terminado</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${greetName}. La prueba gratuita de ${name} terminó el ${formatDate(trialEndAt)}. Tu cuenta ahora está en <strong>modo de solo lectura</strong> — puedes consultar tu información pero no registrar nuevas operaciones.</p>
          <p style="color:#374151;line-height:1.6">Activa tu licencia para recuperar el acceso completo. No se ha borrado nada.</p>
          ${howToPay()}
        `, appUrl),
      };

    case 'license_expiring_7':
      return {
        subject: `Tu licencia de ${APP_NAME} vence en 7 días`,
        html: wrap(`
          <h2 style="color:#d97706;margin-top:0">Tu licencia vence pronto</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu licencia de ${APP_NAME} vence el <strong>${formatDate(licenseExpiresAt)}</strong> (en 7 días).</p>
          <p style="color:#374151;line-height:1.6">Para renovar tu licencia contáctanos antes de esa fecha.</p>
          ${ctaButton('Contactar para renovar', upgradeUrl)}
        `, appUrl),
      };

    case 'license_expiring_3':
      return {
        subject: `Tu licencia de ${APP_NAME} vence en 3 días`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">⚠️ Licencia vence en 3 días</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu licencia vence el <strong>${formatDate(licenseExpiresAt)}</strong>. Si no se renueva, tu cuenta pasará a modo de solo lectura.</p>
          ${ctaButton('Renovar ahora', upgradeUrl)}
          <p style="color:#6b7280;font-size:13px">Urgente: <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'license_expiring_1':
      return {
        subject: `Tu licencia de ${APP_NAME} vence mañana`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">🔴 Tu licencia vence mañana</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu licencia vence <strong>mañana (${formatDate(licenseExpiresAt)})</strong>. Contáctanos hoy mismo para renovarla.</p>
          ${ctaButton('Renovar urgente', upgradeUrl)}
          <p style="color:#6b7280;font-size:13px"><a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'license_expired':
      return {
        subject: `Tu licencia de ${APP_NAME} ha vencido — Modo Solo Lectura activo`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">Licencia vencida</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu licencia de ${APP_NAME} venció el <strong>${formatDate(licenseExpiresAt)}</strong>. Tu cuenta ahora está en <strong>modo de solo lectura</strong>.</p>
          <p style="color:#374151;line-height:1.6">Contáctanos para reactivar tu acceso completo.</p>
          ${ctaButton('Renovar mi licencia', upgradeUrl)}
          <p style="color:#6b7280;font-size:13px"><a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'renewal_upcoming':
      return {
        subject: `Tu licencia de ${APP_NAME} se renueva automáticamente en 7 días`,
        html: wrap(`
          <h2 style="color:#111827;margin-top:0">Aviso de renovación automática</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Te informamos que tu licencia de ${APP_NAME} se <strong>renovará automáticamente</strong> el <strong>${formatDate(licenseExpiresAt)}</strong>.</p>
          <p style="color:#374151;line-height:1.6">No necesitas hacer nada — la renovación es automática. Solo asegúrate de que tu método de pago esté vigente.</p>
          ${ctaButton('Ir a mi cuenta', appUrl)}
          <p style="color:#6b7280;font-size:13px">¿Tienes alguna pregunta? Escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'renewal_confirmed':
      return {
        subject: `¡Tu licencia de ${APP_NAME} se ha renovado exitosamente!`,
        html: wrap(`
          <h2 style="color:#059669;margin-top:0">✅ Licencia renovada</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu licencia de ${APP_NAME} se ha renovado exitosamente. La nueva fecha de vencimiento es el <strong>${formatDate(licenseExpiresAt)}</strong>.</p>
          <p style="color:#374151;line-height:1.6">Gracias por confiar en ${APP_NAME} para gestionar tu inventario.</p>
          ${ctaButton('Ir a mi cuenta', appUrl)}
        `, appUrl),
      };

    case 'license_activated':
      return {
        subject: `✅ Tu licencia de ${APP_NAME}${planName ? ` ${planName}` : ''} está activa por 30 días`,
        html: wrap(`
          <h2 style="color:#059669;margin-top:0">✅ ¡Bienvenido a ${APP_NAME}${planName ? ` ${planName}` : ''}!</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${greetName}. Tu licencia${planName ? ` <strong>${APP_NAME} ${planName}</strong>` : ''} para <strong>${name}</strong> ha sido activada por <strong>30 días</strong>. Tienes acceso completo a todas las funciones.</p>
          <p style="color:#374151;line-height:1.6">Fecha de vencimiento: <strong>${formatDate(licenseExpiresAt)}</strong></p>
          ${ctaButton('Ir a mi cuenta', appUrl)}
          <p style="color:#6b7280;font-size:13px">¿Tienes preguntas? Escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:#059669">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'renewal_charge_reminder_3':
      return {
        subject: `Recordatorio: tu plan ${APP_NAME}${planName ? ` ${planName}` : ''} se renueva en 3 días`,
        html: wrap(`
          <h2 style="color:#d97706;margin-top:0">Tu plan ${APP_NAME}${planName ? ` ${planName}` : ''} se renueva en 3 días</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${greetName}. Te recordamos que Mercado Pago realizará el cobro automático de tu plan${planName ? ` <strong>${APP_NAME} ${planName}</strong>` : ` ${APP_NAME}`} para <strong>${name}</strong> en <strong>3 días</strong>.</p>
          <p style="color:#374151;line-height:1.6">Fecha programada del cobro: <strong>${formatDate(licenseExpiresAt)}</strong></p>
          <p style="color:#374151;line-height:1.6">Asegúrate de que tu método de pago en Mercado Pago esté vigente y con fondos suficientes.</p>
          ${ctaButton('Ir a mi cuenta', appUrl)}
          <p style="color:#6b7280;font-size:13px">¿Tienes preguntas? Escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'renewal_charge_reminder_2':
      return {
        subject: `Recordatorio: tu plan ${APP_NAME}${planName ? ` ${planName}` : ''} se renueva en 2 días`,
        html: wrap(`
          <h2 style="color:#d97706;margin-top:0">Tu plan ${APP_NAME}${planName ? ` ${planName}` : ''} se renueva en 2 días</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${greetName}. Mercado Pago realizará el cobro automático de tu plan${planName ? ` <strong>${APP_NAME} ${planName}</strong>` : ` ${APP_NAME}`} para <strong>${name}</strong> en <strong>2 días</strong>.</p>
          <p style="color:#374151;line-height:1.6">Fecha programada del cobro: <strong>${formatDate(licenseExpiresAt)}</strong></p>
          <p style="color:#374151;line-height:1.6">Asegúrate de que tu método de pago en Mercado Pago esté vigente y con fondos suficientes.</p>
          ${ctaButton('Ir a mi cuenta', appUrl)}
          <p style="color:#6b7280;font-size:13px">¿Tienes preguntas? Escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'renewal_charge_reminder_1':
      return {
        subject: `Recordatorio: tu plan ${APP_NAME}${planName ? ` ${planName}` : ''} se renueva mañana`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">⚠️ Tu plan ${APP_NAME}${planName ? ` ${planName}` : ''} se renueva mañana</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${greetName}. Mañana Mercado Pago realizará el cobro automático de tu plan${planName ? ` <strong>${APP_NAME} ${planName}</strong>` : ` ${APP_NAME}`} para <strong>${name}</strong>.</p>
          <p style="color:#374151;line-height:1.6">Fecha programada del cobro: <strong>${formatDate(licenseExpiresAt)}</strong></p>
          <p style="color:#374151;line-height:1.6">Si tu método de pago no es válido o no tiene fondos suficientes, tu acceso podría verse afectado.</p>
          ${ctaButton('Ir a mi cuenta', appUrl)}
          <p style="color:#6b7280;font-size:13px">¿Necesitas ayuda? Escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'payment_received':
      return {
        subject: `✅ Pago recibido — Tu plan ${APP_NAME}${planName ? ` ${planName}` : ''} se renovó`,
        html: wrap(`
          <h2 style="color:#059669;margin-top:0">✅ Pago recibido y plan renovado</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${greetName}. Hemos confirmado la recepción de tu cobro en Mercado Pago. Tu plan${planName ? ` <strong>${APP_NAME} ${planName}</strong>` : ` ${APP_NAME}`} para <strong>${name}</strong> ha sido renovado exitosamente.</p>
          <p style="color:#374151;line-height:1.6">Tu licencia está activa hasta: <strong>${formatDate(licenseExpiresAt)}</strong></p>
          <p style="color:#374151;line-height:1.6">Gracias por confiar en ${APP_NAME} para gestionar tu inventario.</p>
          ${ctaButton('Ir a mi cuenta', appUrl)}
        `, appUrl),
      };

    case 'account_view_only':
      return {
        subject: `Tu cuenta de ${APP_NAME} está en modo Solo Lectura`,
        html: wrap(`
          <h2 style="color:#d97706;margin-top:0">Cuenta en modo Solo Lectura</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu cuenta de ${APP_NAME} está actualmente en <strong>modo de solo lectura</strong>. Puedes consultar tu información, pero no registrar nuevas operaciones.</p>
          <p style="color:#374151;line-height:1.6">Para reactivar el acceso completo, activa o renueva tu licencia.</p>
          ${ctaButton('Reactivar mi cuenta', upgradeUrl)}
          <p style="color:#6b7280;font-size:13px"><a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'archive_warning':
      return {
        subject: `Tu cuenta de ${APP_NAME} será archivada pronto`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">⚠️ Tu cuenta será archivada</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu cuenta de ${APP_NAME} lleva más de 10 días en modo de solo lectura. Si no activas tu licencia pronto, la cuenta será <strong>archivada</strong>.</p>
          <p style="color:#374151;line-height:1.6">Una cuenta archivada tiene 30 días antes de ser eliminada permanentemente junto con todos sus datos.</p>
          ${ctaButton('Activar mi licencia', upgradeUrl)}
          <p style="color:#dc2626;font-size:13px;font-weight:600">Por favor actúa pronto para evitar la pérdida de tus datos.</p>
          <p style="color:#6b7280;font-size:13px"><a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'account_archived':
      return {
        subject: `Tu cuenta de ${APP_NAME} ha sido archivada`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">Cuenta archivada</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu cuenta de ${APP_NAME} ha sido <strong>archivada</strong>. Tus datos se conservarán hasta el <strong>${formatDate(scheduledDeleteAt)}</strong>, fecha en que serán eliminados permanentemente.</p>
          <p style="color:#374151;line-height:1.6">Si deseas recuperar tu cuenta contáctanos <strong>antes</strong> de esa fecha.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="mailto:${SUPPORT_EMAIL}" style="background:#dc2626;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Contactar soporte para reactivar</a>
          </div>
          <p style="color:#6b7280;font-size:13px">Fecha límite para recuperación: <strong>${formatDate(scheduledDeleteAt)}</strong></p>
        `, appUrl),
      };

    case 'delete_warning':
      return {
        subject: `AVISO FINAL: tus datos de ${APP_NAME} serán eliminados en 7 días`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">🚨 AVISO FINAL — Eliminación en 7 días</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Este es un aviso final: tu cuenta de ${APP_NAME} y <strong>todos tus datos serán eliminados permanentemente</strong> el <strong>${formatDate(scheduledDeleteAt)}</strong>.</p>
          <p style="color:#374151;line-height:1.6">Después de esa fecha no será posible recuperar ningún dato. Si deseas conservar tu información, contacta a soporte inmediatamente.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="mailto:${SUPPORT_EMAIL}" style="background:#dc2626;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Contactar soporte URGENTE</a>
          </div>
        `, appUrl),
      };

    case 'account_deleted_confirmation':
      return {
        subject: `Tu cuenta de ${APP_NAME} ha sido eliminada`,
        html: wrap(`
          <h2 style="color:#111827;margin-top:0">Cuenta eliminada</h2>
          <p style="color:#374151;line-height:1.6">Hola. Tu cuenta de ${APP_NAME} (${name}) y todos sus datos han sido eliminados de acuerdo a nuestra política de retención de datos.</p>
          <p style="color:#374151;line-height:1.6">Si crees que esto es un error o necesitas asistencia, contáctanos.</p>
          <p style="color:#374151;line-height:1.6">Gracias por haber usado ${APP_NAME}.</p>
          <p style="color:#6b7280;font-size:13px"><a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'trial_reactivation': {
      const daysLeft = ctx.daysLeft ?? 0;
      return {
        subject: `Te extrañamos en ${APP_NAME} — aún tienes ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} de prueba`,
        html: wrap(`
          <h2 style="color:#111827;margin-top:0">¡Hola ${greetName}, te extrañamos en ${APP_NAME}! 👋</h2>
          <p style="color:#374151;line-height:1.6">Vimos que no has usado ${APP_NAME} en los últimos días y queríamos recordarte que tu prueba gratuita sigue activa.</p>
          <div style="background:#eff6ff;border-left:4px solid ${BRAND_COLOR};padding:14px 18px;border-radius:4px;margin:16px 0">
            <p style="margin:0;color:#1e40af;font-size:18px;font-weight:700">⏰ Te quedan ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} de prueba</p>
          </div>
          <ul style="color:#374151;line-height:1.8;padding-left:20px">
            <li>Controlar tu inventario</li>
            <li>Registrar entradas y salidas de productos</li>
            <li>Crear y administrar cotizaciones</li>
            <li>Dar seguimiento a clientes y proveedores</li>
            <li>Recibir alertas de stock bajo</li>
            <li>Consultar reportes para tomar mejores decisiones</li>
          </ul>
          ${ctaButton('Volver a StockFlow', appUrl)}
          <p style="color:#9ca3af;font-size:12px">Equipo ${APP_NAME}</p>
        `, appUrl),
      };
    }

    default:
      return null;
  }
}

// Days before trial_end_at (customer's local calendar date) → email. Windows
// rather than exact days so one missed cron run doesn't drop a reminder; the
// idempotency key (keyed on the trial end date) keeps each one to a single send
// per trial, and an extended trial re-qualifies with its new date.
const TRIAL_REMINDERS = [
  { type: 'trial_day_15', min: 13, max: 15 },
  { type: 'trial_day_25', min: 3, max: 5 },
  { type: 'trial_day_28', min: 1, max: 2 },
  { type: 'trial_day_30', min: 0, max: 0 },
  { type: 'trial_expired', min: -3, max: -1 },
];

function mxDateKey(ms) {
  return new Date(ms - MX_OFFSET_MS).toISOString().slice(0, 10);
}

function trialReminderFor(trialEndAt, now = new Date()) {
  const end = new Date(trialEndAt).getTime();
  if (Number.isNaN(end)) return null;
  const daysLeft = Math.round(
    (Date.parse(mxDateKey(end)) - Date.parse(mxDateKey(now.getTime()))) / DAY_MS
  );
  return TRIAL_REMINDERS.find((r) => daysLeft >= r.min && daysLeft <= r.max)?.type ?? null;
}

async function enqueueTrialReminders(base44) {
  const now = new Date();
  const trials = await base44.asServiceRole.entities.Business.filter({ billing_status: 'trial' });
  let created = 0;
  for (const biz of trials) {
    if (!biz.trial_end_at || biz.archived_at) continue;
    const type = trialReminderFor(biz.trial_end_at, now);
    if (!type) continue;
    const users = await base44.asServiceRole.entities.User.filter({ business_id: biz.id });
    const admins = users.filter((u) => (u.role === 'admin' || u.role === 'owner') && u.email);
    for (const admin of admins) {
      const key = `${type}:${biz.id}:${admin.email}:${String(biz.trial_end_at).slice(0, 10)}`;
      const existing = await base44.asServiceRole.entities.EmailNotification.filter({ idempotency_key: key });
      if (existing.length > 0) continue;
      await base44.asServiceRole.entities.EmailNotification.create({
        business_id: biz.id,
        email_type: type,
        recipient_email: admin.email,
        user_id: admin.id,
        status: 'pending',
        retry_count: 0,
        idempotency_key: key,
      });
      created++;
    }
  }
  console.log(`[sendLifecycleEmails] queued ${created} trial reminder(s)`);
  return created;
}

async function loadBusiness(base44, cache, id) {
  if (!cache.has(id)) {
    const rows = await base44.asServiceRole.entities.Business.filter({ id }).catch(() => []);
    cache.set(id, rows[0] || null);
  }
  return cache.get(id);
}

// Inline jobs (no id) have no row to update; queued rows do.
async function markRow(base44, job, patch) {
  if (!job?.id) return;
  try {
    await base44.asServiceRole.entities.EmailNotification.update(job.id, patch);
  } catch (err) {
    console.error(`[sendLifecycleEmails] could not mark ${job.id} as ${patch.status}:`, (err as Error).message);
  }
}

// Core.SendEmail has no bcc, so the platform owner gets a separate copy of
// every customer email. Best-effort: never fails the customer send.
async function sendOwnerCopy(base44, recipient, template) {
  if (!PLATFORM_OWNER_EMAIL || recipient === PLATFORM_OWNER_EMAIL) return;
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: PLATFORM_OWNER_EMAIL,
      subject: `[Copia → ${recipient}] ${template.subject}`,
      body: template.html,
      from_name: APP_NAME,
    });
  } catch (err) {
    console.warn('[sendLifecycleEmails] owner copy failed:', (err as Error).message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const cronSecretEnv = Deno.env.get('CRON_SECRET');
    const validCron = cronSecretEnv && (
      req.headers.get('x-cron-secret') === cronSecretEnv ||
      body?.['x-cron-secret'] === cronSecretEnv
    );
    if (!validCron) {
      // Platform-wide cron (sends queued lifecycle emails across every
      // tenant when no explicit `jobs` batch is provided) — manual trigger is
      // platform-owner only, NOT any tenant's role:admin user.
      const user = await base44.auth.me().catch(() => null);
      if (!user || !PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const appUrl = Deno.env.get('APP_URL') || UPGRADE_URL;

    let finalBatch = [];
    let queued = 0;

    if (Array.isArray(body.jobs) && body.jobs.length > 0) {
      finalBatch = body.jobs;
      console.log(`[sendLifecycleEmails] Using ${finalBatch.length} inline jobs from request body`);
    } else {
      // Trial countdown. Nothing else queues these since the native trial crons
      // were retired (2026-08-03) and Mission Control only tracks
      // license_expires_at, which is null during a trial. Read-only on
      // billing_status: this never transitions a license, it only emails.
      try {
        queued = await enqueueTrialReminders(base44);
      } catch (err) {
        console.error('[sendLifecycleEmails] enqueueTrialReminders failed:', (err as Error).message);
      }
      try {
        const allNotifications = [
          ...await base44.asServiceRole.entities.EmailNotification.filter({ status: 'pending' }),
          ...await base44.asServiceRole.entities.EmailNotification.filter({ status: 'failed' }),
        ];
        const toProcess = allNotifications.filter(
          (n) => n.status === 'pending' || (n.status === 'failed' && (n.retry_count || 0) < MAX_RETRIES)
        );
        const seenKeys = new Set();
        for (const n of toProcess) {
          const key = n.idempotency_key || `${n.business_id}:${n.email_type}:${n.recipient_email}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            finalBatch.push(n);
          } else {
            await markRow(base44, n, { status: 'skipped', skip_reason: `duplicate of ${key}` });
          }
        }
        console.log(`[sendLifecycleEmails] Using ${finalBatch.length} jobs from EmailNotification entity`);
      } catch (entityErr) {
        console.warn(`[sendLifecycleEmails] EmailNotification entity not available: ${entityErr.message}`);
        return Response.json({ success: true, sent: 0, failed: 0, batch_size: 0, note: 'EmailNotification entity not available' });
      }
    }

    let sent = 0;
    let failed = 0;
    const errors = [];
    const bizCache = new Map();

    for (const job of finalBatch) {
      // Queued rows carry only ids; resolve the business and recipient name
      // so the email names the business instead of "tu negocio".
      const biz = job.business_id ? await loadBusiness(base44, bizCache, job.business_id) : null;
      const ctx = {
        businessName: job.business_name || biz?.name || 'tu negocio',
        recipientName: job.recipient_name || null,
        licensePlan: job.license_plan || biz?.license_plan || null,
        appUrl,
        supportEmail: SUPPORT_EMAIL,
        upgradeUrl: UPGRADE_URL,
        licenseExpiresAt: job.license_expires_at || biz?.license_expires_at || null,
        scheduledDeleteAt: job.scheduled_delete_at || biz?.scheduled_delete_at || null,
        trialEndAt: job.trial_end_at || biz?.trial_end_at || null,
      };

      const template = getEmailTemplate(job.email_type, ctx);
      if (!template) {
        console.warn(`[sendLifecycleEmails] Unknown email_type: ${job.email_type}`);
        failed++;
        errors.push({ type: job.email_type, recipient: job.recipient_email, error: 'Unknown email_type' });
        await markRow(base44, job, { status: 'skipped', skip_reason: 'Unknown email_type' });
        continue;
      }

      const attemptAt = new Date().toISOString();
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: job.recipient_email,
          subject: template.subject,
          body: template.html,
          from_name: APP_NAME,
        });
        sent++;
        console.log(`[sendLifecycleEmails] Sent ${job.email_type} to ${job.recipient_email}`);
        // Without this the row stays pending and the daily cron re-sends it forever.
        await markRow(base44, job, { status: 'sent', sent_at: attemptAt, last_attempt_at: attemptAt, error_message: null });
        await sendOwnerCopy(base44, job.recipient_email, template);
      } catch (err) {
        failed++;
        const msg = String(err?.message || err);
        errors.push({ type: job.email_type, recipient: job.recipient_email, error: msg });
        console.error(`[sendLifecycleEmails] Failed ${job.email_type} to ${job.recipient_email}:`, msg);
        await markRow(base44, job, {
          status: 'failed', retry_count: (job.retry_count || 0) + 1, last_attempt_at: attemptAt, error_message: msg,
        });
      }
    }

    console.log(`[sendLifecycleEmails] sent=${sent} failed=${failed} batch=${finalBatch.length}`);
    return Response.json({ success: true, sent, failed, queued, batch_size: finalBatch.length, errors });

  } catch (error) {
    console.error('[sendLifecycleEmails] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});