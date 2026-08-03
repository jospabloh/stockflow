# Automatización de Licencias StockFlow — RETIRADA (2026-08-03)

StockFlow ya **no** tiene automatización nativa de ciclo de vida de licencia.
Las funciones `checkAccountLifecycle`, `processMonthlyRenewal`,
`checkTenantLicense`, `expireTrials`, `queueBillingReminders` y
`migrateViewOnlySince` fueron **eliminadas** de este repo — Mission Control
(`jospabloh/acacia-mission-control`, `api/cron/license-lifecycle.js`) es ahora
la **única** autoridad del ciclo de vida de licencia en todo el portafolio
(trial → view_only → suspended, vía `Business.billing_status`).

## Qué hacer si aún hay crons agendados en el panel de Base44

Este cambio de repo **no** desagenda un cron ya configurado en el dashboard de
Base44 — eso requiere una acción aparte:

1. Deploy este cambio: `npx base44 login && npx base44 deploy -y --force`
   (el `--force` poda del backend las funciones ya removidas del repo).
2. Verificar en el panel de scheduler de Base44 que los cron jobs de
   `checkAccountLifecycle` y `processMonthlyRenewal` ya no aparezcan (o
   eliminarlos manualmente ahí si el deploy no los quita).

## Gap conocido: recordatorio de cobro automático (Mercado Pago)

`checkAccountLifecycle` también enviaba `renewal_charge_reminder_3/2/1` — un
aviso a tenants con `auto_renewal: true` de que Mercado Pago los va a cobrar en
3/2/1 días. Mission Control **no reproduce ese aviso hoy** (su modelo de ciclo
de vida cuenta días de gracia *después* de vencido, no antes del cobro
automático). Si StockFlow sigue teniendo cobro automático real vía
preapproval de Mercado Pago, ese hueco necesita resolverse en Mission Control
(o quedar aceptado como pérdida de funcionalidad) antes de asumir paridad
completa con lo que había antes.

## Referencia histórica

El prompt original (para agendar los cron ya eliminados) y la tabla de flujos
de email siguen documentados en el historial de git de este archivo, por si
hace falta reconstruir el contexto — ver `git log -- base44/AUTOMATION_SETUP_PROMPT.md`.
