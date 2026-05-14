import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

const PLATFORM_OWNER_EMAIL = 'h.josepablo@gmail.com';
const SUPPORT_EMAIL = 'soporte@acaciaco.com.mx';
const APP_NAME = 'StockFlow';
const BRAND_COLOR = '#4F46E5';
const UPGRADE_URL = 'https://www.acaciaco.com.mx/stockflow';

const ALL_EMAIL_TYPES = [
  'trial_welcome',
  'trial_day_15',
  'trial_day_25',
  'trial_day_28',
  'trial_day_30',
  'trial_expired',
  'license_expiring_7',
  'license_expiring_3',
  'license_expiring_1',
  'license_expired',
  'renewal_upcoming',
  'renewal_confirmed',
  'account_view_only',
  'archive_warning',
  'account_archived',
  'delete_warning',
  'account_deleted_confirmation',
];

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch (_) {
    return isoString;
  }
}

function wrap(bodyHtml: string, appUrl: string): string {
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

function ctaButton(label: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0">
    <a href="${url}" style="background:${BRAND_COLOR};color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">${label}</a>
  </div>`;
}

function getEmailTemplate(
  emailType: string,
  ctx: {
    businessName: string;
    appUrl: string;
    upgradeUrl: string;
    licenseExpiresAt?: string | null;
    scheduledDeleteAt?: string | null;
  }
): { subject: string; html: string } | null {
  const { businessName, appUrl, upgradeUrl, licenseExpiresAt, scheduledDeleteAt } = ctx;
  const name = businessName || 'tu negocio';

  switch (emailType) {
    case 'trial_welcome':
      return {
        subject: `Bienvenido a ${APP_NAME} — Tu prueba gratuita de 30 días ha comenzado`,
        html: wrap(`
          <h2 style="color:#111827;margin-top:0">¡Bienvenido a ${APP_NAME}, ${name}!</h2>
          <p style="color:#374151;line-height:1.6">Tu período de prueba gratuita de <strong>30 días</strong> ha comenzado. Durante este tiempo tienes acceso completo a todas las funciones de ${APP_NAME}.</p>
          <p style="color:#374151;line-height:1.6">Puedes gestionar tu inventario, crear cotizaciones, registrar movimientos y mucho más.</p>
          ${ctaButton('Ir a mi cuenta', appUrl)}
          <p style="color:#6b7280;font-size:13px">¿Tienes preguntas? Contáctanos en <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'trial_day_15':
      return {
        subject: `15 días con ${APP_NAME} — ¿Cómo va tu experiencia?`,
        html: wrap(`
          <h2 style="color:#111827;margin-top:0">Ya llevas 15 días con ${APP_NAME}</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Esperamos que ${APP_NAME} esté ayudando a tu negocio. Te quedan <strong>15 días</strong> de prueba gratuita.</p>
          <p style="color:#374151;line-height:1.6">Si necesitas ayuda o tienes preguntas, estamos aquí para apoyarte.</p>
          ${ctaButton('Ver planes y precios', upgradeUrl)}
        `, appUrl),
      };

    case 'trial_day_25':
      return {
        subject: `Tu prueba de ${APP_NAME} termina en 5 días`,
        html: wrap(`
          <h2 style="color:#d97706;margin-top:0">⏰ Quedan 5 días de prueba</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu período de prueba gratuita termina en <strong>5 días</strong>. Para seguir usando ${APP_NAME} sin interrupciones, activa tu licencia.</p>
          ${ctaButton('Activar licencia ahora', upgradeUrl)}
          <p style="color:#6b7280;font-size:13px">¿Tienes preguntas sobre los planes? Escríbenos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
        `, appUrl),
      };

    case 'trial_day_28':
      return {
        subject: `Quedan solo 2 días de prueba en ${APP_NAME}`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">🚨 Último aviso: 2 días restantes</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu prueba termina en <strong>2 días</strong>. Si no activas tu licencia, tu cuenta entrará en modo de solo lectura y no podrás registrar nuevas operaciones.</p>
          ${ctaButton('Activar mi licencia', upgradeUrl)}
          <p style="color:#6b7280;font-size:13px">Contáctanos en <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a> si necesitas ayuda.</p>
        `, appUrl),
      };

    case 'trial_day_30':
      return {
        subject: `Hoy es el último día de tu prueba en ${APP_NAME}`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">🔴 Último día de prueba</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Hoy termina tu período de prueba gratuita. Después de hoy, tu cuenta pasará a modo de solo lectura.</p>
          <p style="color:#374151;line-height:1.6">¡Activa tu licencia ahora para mantener acceso completo!</p>
          ${ctaButton('Activar ahora', upgradeUrl)}
        `, appUrl),
      };

    case 'trial_expired':
      return {
        subject: `Tu prueba de ${APP_NAME} ha expirado — Activa tu licencia`,
        html: wrap(`
          <h2 style="color:#dc2626;margin-top:0">Tu período de prueba ha terminado</h2>
          <p style="color:#374151;line-height:1.6">Hola, ${name}. Tu prueba gratuita de ${APP_NAME} ha expirado. Tu cuenta ahora está en <strong>modo de solo lectura</strong> — puedes consultar tu información pero no registrar nuevas operaciones.</p>
          <p style="color:#374151;line-height:1.6">Activa tu licencia para recuperar el acceso completo a todas las funciones.</p>
          ${ctaButton('Activar mi licencia', upgradeUrl)}
          <p style="color:#6b7280;font-size:13px">¿Necesitas más información? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR}">${SUPPORT_EMAIL}</a></p>
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

    default:
      return null;
  }
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.email !== PLATFORM_OWNER_EMAIL) {
      return Response.json({ error: 'Forbidden: platform owner only' }, { status: 403 });
    }

    const appUrl = Deno.env.get('APP_URL') || UPGRADE_URL;

    const now = new Date();
    const licenseExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const scheduledDeleteAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const ctx = {
      businessName: 'StockFlow (Correo de Prueba)',
      appUrl,
      upgradeUrl: UPGRADE_URL,
      licenseExpiresAt,
      scheduledDeleteAt,
    };

    let sent = 0;
    let failed = 0;
    const results: any[] = [];

    for (const emailType of ALL_EMAIL_TYPES) {
      const template = getEmailTemplate(emailType, ctx);
      if (!template) {
        results.push({ type: emailType, status: 'failed', error: 'Unknown email_type' });
        failed++;
        continue;
      }

      const subject = `[PRUEBA] ${template.subject}`;

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: PLATFORM_OWNER_EMAIL,
          subject,
          body: template.html,
          from_name: APP_NAME,
        });
        results.push({ type: emailType, subject, status: 'sent' });
        sent++;
        console.log(`[sendTestLifecycleEmails] Sent ${emailType}`);
      } catch (err: Error | unknown) {
        const error = err instanceof Error ? err.message : String(err);
        results.push({ type: emailType, subject, status: 'failed', error });
        failed++;
        console.error(`[sendTestLifecycleEmails] Failed ${emailType}: ${error}`);
      }
    }

    return Response.json({
      success: failed === 0,
      recipient: PLATFORM_OWNER_EMAIL,
      sent,
      failed,
      total: ALL_EMAIL_TYPES.length,
      results,
    });

  } catch (error: Error | unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[sendTestLifecycleEmails] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
