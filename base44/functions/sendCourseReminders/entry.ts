import { createClientFromRequest } from 'npm:@base44/sdk@0.8.24';

const PLATFORM_OWNER_EMAIL = Deno.env.get('PLATFORM_OWNER_EMAIL');

/**
 * Cron diario: envía recordatorios de cursos a los inscritos cuya próxima sesión
 * es mañana (status confirmado/pagado y sin recordatorio previo).
 * Delega en courseComms/runReminders, que hace el barrido y el envío.
 *
 * Programación: configúrala en el panel de Base44 (ej. diario 09:00 hora local),
 * enviando el header x-cron-secret = CRON_SECRET.
 */
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
      const user = await base44.auth.me().catch(() => null);
      if (!user || (!PLATFORM_OWNER_EMAIL || user.email !== PLATFORM_OWNER_EMAIL) && user.role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const result = await base44.asServiceRole.functions.invoke('courseComms', {
      action: 'runReminders',
      'x-cron-secret': cronSecretEnv || '',
    });
    console.log('[sendCourseReminders] runReminders result:', JSON.stringify(result));
    return Response.json({ success: true, delegated_to: 'courseComms.runReminders', ...result });

  } catch (error) {
    console.error('[sendCourseReminders] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
