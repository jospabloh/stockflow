import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        const { issue_type, description, user_name, user_email } = await req.json();

        const subjectMap = {
            bug: '🐛 Bug reportado por usuario',
            mejora: '💡 Sugerencia de mejora de usuario',
        };

        const subject = subjectMap[issue_type] || '📩 Reporte de usuario en StockFlow';
        const from_name = 'StockFlow Asistente';
        const to = 'h.josepablo@gmail.com';

        const body = `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: ${issue_type === 'bug' ? '#ef4444' : '#6366f1'};">
    ${issue_type === 'bug' ? '🐛 Nuevo Bug Reportado' : '💡 Nueva Sugerencia de Mejora'}
  </h2>
  <table style="width:100%; border-collapse:collapse; margin-top:16px;">
    <tr>
      <td style="padding:8px; font-weight:bold; color:#64748b;">Usuario:</td>
      <td style="padding:8px;">${user_name || 'Desconocido'}</td>
    </tr>
    <tr style="background:#f8fafc;">
      <td style="padding:8px; font-weight:bold; color:#64748b;">Email:</td>
      <td style="padding:8px;">${user_email || 'No disponible'}</td>
    </tr>
    <tr>
      <td style="padding:8px; font-weight:bold; color:#64748b;">Tipo:</td>
      <td style="padding:8px; text-transform:capitalize;">${issue_type}</td>
    </tr>
    <tr style="background:#f8fafc;">
      <td style="padding:8px; font-weight:bold; color:#64748b; vertical-align:top;">Descripción:</td>
      <td style="padding:8px;">${description}</td>
    </tr>
  </table>
  <p style="margin-top:24px; color:#64748b; font-size:12px;">
    Enviado automáticamente por el Asistente de StockFlow
  </p>
</div>
        `.trim();

        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body, from_name });

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});