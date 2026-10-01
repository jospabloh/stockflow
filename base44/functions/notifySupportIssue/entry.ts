import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me().catch(() => null);
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Each call sends a mail on the platform's email credits: users need a tenant,
        // and free-text fields are length-capped so a session can't push arbitrary bulk.
        if (!user.business_id) return Response.json({ error: 'Forbidden: no business_id' }, { status: 403 });

        const { issue_type, description: rawDescription, user_name, user_email } = await req.json();
        const description = String(rawDescription || '').slice(0, 4000);
        const reporter_name = String(user_name || user?.full_name || 'Desconocido').slice(0, 120);
        const reporter_email = String(user_email || user?.email || 'No disponible').slice(0, 200);

        const escapeHtml = (str) => String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        const safe_name = escapeHtml(reporter_name);
        const safe_email = escapeHtml(reporter_email);
        const safe_type = escapeHtml(issue_type);
        const safe_description = escapeHtml(description || '');

        const subjectMap = {
            bug: '🐛 Bug reportado por usuario',
            mejora: '💡 Sugerencia de mejora de usuario',
        };

        const subject = subjectMap[issue_type] || '📩 Reporte de usuario en StockFlow';
        const from_name = 'StockFlow Asistente';
        const to = Deno.env.get('SUPPORT_EMAIL') || Deno.env.get('PLATFORM_OWNER_EMAIL');

        const body = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: ${issue_type === 'bug' ? '#ef4444' : '#6366f1'};">
    ${issue_type === 'bug' ? '🐛 Nuevo Bug Reportado' : '💡 Nueva Sugerencia de Mejora'}
  </h2>
  <table style="width:100%; border-collapse:collapse; margin-top:16px;">
    <tr>
      <td style="padding:8px; font-weight:bold; color:#64748b;">Usuario:</td>
      <td style="padding:8px;">${safe_name}</td>
    </tr>
    <tr style="background:#f8fafc;">
      <td style="padding:8px; font-weight:bold; color:#64748b;">Email:</td>
      <td style="padding:8px;">${safe_email}</td>
    </tr>
    <tr>
      <td style="padding:8px; font-weight:bold; color:#64748b;">Tipo:</td>
      <td style="padding:8px; text-transform:capitalize;">${safe_type}</td>
    </tr>
    <tr style="background:#f8fafc;">
      <td style="padding:8px; font-weight:bold; color:#64748b; vertical-align:top;">Descripción:</td>
      <td style="padding:8px; white-space:pre-wrap;">${safe_description}</td>
    </tr>
  </table>
  <p style="margin-top:24px; color:#64748b; font-size:12px;">
    Enviado automáticamente por el Asistente de StockFlow
  </p>
</div>
        `.trim();

        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body, from_name });

        return Response.json({ success: true });
    } catch (error: Error | unknown) {
        const err = error instanceof Error ? (error as Error).message : String(error);
        return Response.json({ error: err }, { status: 500 });
    }
});