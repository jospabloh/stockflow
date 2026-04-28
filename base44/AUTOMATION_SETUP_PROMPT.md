# Automatización de Licencias StockFlow — Prompt para Base44

Este documento contiene **el prompt exacto** para que pegues en el chat/copilot de Base44
y configure las automatizaciones del ciclo de licencia + Mercado Pago. La aplicación
StockFlow ya tiene las funciones desplegadas; lo único que falta es **agendar dos
llamadas cron diarias** y, opcionalmente, configurar dos variables de entorno.

---

## Variables de entorno (configurar en Base44 una sola vez)

| Variable | Valor sugerido | Uso |
|---|---|---|
| `CRON_SECRET` | una cadena aleatoria de 32+ caracteres (ej. `openssl rand -hex 32`) | Autoriza al scheduler a invocar funciones sin sesión |
| `APP_URL` | la URL pública de tu deploy (ej. `https://stockflow.acaciaco.com.mx`) | Permite que las funciones se llamen entre sí |

---

## Prompt para Base44 (cópialo textual en el chat de Base44)

```
Necesito que configures dos cron jobs diarios en este proyecto Base44.

CONTEXTO
- StockFlow tiene funciones serverless (Deno) que gestionan el ciclo de
  licencia de cada tenant: trial -> active -> view_only -> archived ->
  deleted, con renovación automática mensual via Mercado Pago.
- Las funciones ya están desplegadas. NO modifiques su código.
- Los cron deben llamar las funciones via HTTP POST con el header
  `x-cron-secret: <valor de CRON_SECRET>` para autorización.

OBJETIVO
1) Agendar `checkAccountLifecycle` para correr UNA VEZ AL DIA.
   - Frecuencia recomendada: cada día a las 08:00 hora Ciudad de México
     (14:00 UTC en horario de invierno, 13:00 UTC en horario de verano).
   - Si el scheduler no admite zona horaria, usa 14:00 UTC fijo.
   - Método: POST
   - URL: ${APP_URL}/functions/v1/checkAccountLifecycle
   - Headers:
       Content-Type: application/json
       x-cron-secret: ${CRON_SECRET}
   - Body: {}
   - Esta función:
       * Transiciona trials vencidos a view_only
       * Archiva tenants con 15+ días en view_only
       * Elimina tenants archivados cuya scheduled_delete_at ya pasó
       * Encola correos: trial_day_15/25/28/30, trial_expired,
         account_view_only, archive_warning, account_archived,
         delete_warning, account_deleted_confirmation, license_expired,
         renewal_charge_reminder_3, renewal_charge_reminder_2,
         renewal_charge_reminder_1.
       * Despacha la cola via sendLifecycleEmails internamente.

2) Agendar `processMonthlyRenewal` para correr UNA VEZ AL DIA.
   - Frecuencia recomendada: cada día a las 09:00 hora Ciudad de México
     (15:00 UTC en horario de invierno, 14:00 UTC en horario de verano).
   - Método: POST
   - URL: ${APP_URL}/functions/v1/processMonthlyRenewal
   - Headers:
       Content-Type: application/json
       x-cron-secret: ${CRON_SECRET}
   - Body: {}
   - Esta función se auto-protege: solo opera si el día actual es 1.
     Para los demás días retorna { skipped: true }. Por eso se puede
     correr a diario sin riesgo.
   - Solo extiende la fecha de licencia +1 mes para tenants
     active+auto_renewal. NO envía correo de confirmación — eso lo
     dispara el dueño de plataforma manualmente via confirmRenewalPayment.

VERIFICACIÓN (ejecuta después de configurar)
- Llama manualmente checkAccountLifecycle con el header x-cron-secret
  correcto. Espera 200 OK con un objeto { success: true, results: ... }.
- Llama manualmente processMonthlyRenewal. Si hoy NO es día 1, espera
  { skipped: true, reason: "Not the 1st of the month" }. Si quieres
  forzarlo en pruebas, manda body { "force": true }.
- Confirma que ambos cron quedaron registrados con sus URLs y horarios
  correctos en el panel de scheduler.

NO HAGAS
- No modifiques el código de las funciones.
- No cambies el secret existente si ya hay uno; en ese caso usa el
  mismo en los dos cron.
- No agendes processMonthlyRenewal en el día 1 a las 00:00 — el envío
  de correos puede chocar con la transición de fecha. 09:00 local es
  seguro.

REPORTA AL TERMINAR
- URLs configuradas
- Horario UTC final de cada cron
- Resultado de las dos llamadas de verificación (status code + body)
```

---

## Resumen rápido de los flujos de email

| Email | Trigger | Función que lo encola |
|---|---|---|
| `license_activated` | Owner cambia `billing_status` de trial→active manualmente | `adminUpdateTenantLicense` |
| `renewal_charge_reminder_3` | 3 días antes de `license_expires_at` (auto_renewal=true) | `checkAccountLifecycle` (cron diario) |
| `renewal_charge_reminder_2` | 2 días antes | `checkAccountLifecycle` (cron diario) |
| `renewal_charge_reminder_1` | 1 día antes | `checkAccountLifecycle` (cron diario) |
| `payment_received` | Owner click "Confirmar pago recibido" en LicenseAdmin tras día 1 | `confirmRenewalPayment` |

Más los emails de ciclo trial/view_only/archive que ya existían.

---

## Flujo end-to-end (sanity check)

1. Cliente entra a `https://www.acaciaco.com.mx/stockflow` y elige plan.
2. Cliente paga en Mercado Pago (preapproval). MP redirige a `https://acaciaco.com.mx/gracias`.
3. Owner recibe notificación de MP, abre `/LicenseAdmin` y edita el tenant:
   - billing_status: `active`
   - license_plan: `start` | `growth` | `pro`
   - auto_renewal: `true`
   - license_expires_at: 1° del próximo mes
   - payment_reference: ID de la transacción MP
4. **AUTOMÁTICO**: se envía `license_activated` al/los admin(s) del tenant.
5. Faltando 3, 2 y 1 día para `license_expires_at`, el cron diario envía
   `renewal_charge_reminder_3/2/1`.
6. El día 1 MP cobra. El cron `processMonthlyRenewal` extiende la fecha +1 mes.
7. Owner verifica el cobro en MP, abre `/LicenseAdmin`, hace clic en el botón
   ✓ verde junto al tenant → **AUTOMÁTICO**: se envía `payment_received`.
