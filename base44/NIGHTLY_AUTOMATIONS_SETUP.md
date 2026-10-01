# Automatizaciones Nocturnas StockFlow — Setup

> **Ola 4 (router `jobs`)**: todas las tareas programadas viven ahora en la función `jobs`
> (`POST /functions/v1/jobs`, body `{"action": "<nombre>"}`, mismo header `x-cron-secret`).
> Actions: `sendLifecycleEmails`, `processTrialReactivationEmails`, `dailyPermissionAudit`,
> `dailyDocumentationAudit`, `dailyStockReconcile`, `cleanupSessions`. Workflows en repo:
> Daily Stock Reconcile (solo lectura, apunta a `jobs`; sirve de prueba de que Base44 entrega `args`).
> Send Lifecycle Emails y Trial Reactivation Emails Daily siguen apuntando a las funciones viejas hasta
> confirmar esa entrega; luego se repuntan en un PR aparte. `cleanupSessions` existe como action pero NO
> se programa: decisión del owner tras medir el impacto (>1000 sesiones viejas, cross-tenant). `dailyPermissionAudit` y `dailyDocumentationAudit` escriben datos
> (PermissionProfile / AppChangelog / AppVersion) y NO se programan desde el repo: siguen como
> crons HTTP del panel (actualizar su URL/body según el prompt de abajo).
> Recordatorios de cursos: cron del panel -> `/functions/v1/courseComms`, body `{"action":"runReminders"}`
> (reemplaza al wrapper `sendCourseReminders`).

Este documento contiene el **prompt exacto** para configurar los dos cron jobs nocturnos
en Base44, y los pasos de verificación post-deploy.

---

## Variables de entorno requeridas

Configúralas en Base44 → Settings → Environment Variables **antes** de crear los crons:

| Variable | Descripción |
|---|---|
| `CRON_SECRET` | Cadena aleatoria ≥32 chars. Genera con `openssl rand -hex 32`. |
| `ANTHROPIC_API_KEY_SF_SF` | API key de Anthropic para generación de changelogs. Solo la necesita `dailyDocumentationAudit`. |

---

## Prompt para Base44 (cópialo textual en el chat de Base44)

```
Necesito que configures dos cron jobs nocturnos adicionales en este proyecto Base44.

CONTEXTO
- StockFlow es un SaaS multi-tenant de gestión de inventario.
- Las funciones ya están desplegadas como Deno edge functions.
- Los cron deben llamar las funciones via HTTP POST con header
  `x-cron-secret: <valor de CRON_SECRET>` para autorización.
- El CRON_SECRET ya está configurado como variable de entorno.

CRON 1 — dailyPermissionAudit
- Horario: cada día a las 09:00 hora Ciudad de México (15:00 UTC invierno / 14:00 UTC verano).
  Si el scheduler no admite zona horaria usa: 15:00 UTC fijo. Expresión cron: 0 9 * * *
- Método: POST
- URL: ${APP_URL}/functions/v1/jobs   (router; antes /functions/v1/dailyPermissionAudit)
- Headers:
    Content-Type: application/json
    x-cron-secret: ${CRON_SECRET}
- Body: {"action":"dailyPermissionAudit"}
- Qué hace:
    * Recorre todos los negocios (Business) × roles (admin, almacenista)
    * Para cada par, verifica que exista un PermissionProfile en BD
    * Crea perfiles faltantes con los 142 permisos por defecto del rol
    * Actualiza perfiles existentes añadiendo claves nuevas sin pisar valores actuales
    * Opera en batches de 50 operaciones para no exceder límites de la API
    * Envía reporte por email al platform owner al finalizar

CRON 2 — dailyDocumentationAudit
- Horario: cada día a las 09:15 hora Ciudad de México (15:15 UTC invierno / 14:15 UTC verano).
  Si el scheduler no admite zona horaria usa: 15:15 UTC fijo. Expresión cron: 15 9 * * *
- Método: POST
- URL: ${APP_URL}/functions/v1/jobs   (router; antes /functions/v1/dailyDocumentationAudit)
- Headers:
    Content-Type: application/json
    x-cron-secret: ${CRON_SECRET}
- Body: {"action":"dailyDocumentationAudit"}
- Requiere secreto adicional: ANTHROPIC_API_KEY_SF configurado como variable de entorno.
- Qué hace:
    * Compara la versión en código (SNAPSHOT_VERSION baked en la función) vs AppChangelog en BD
    * Si desincronizado: llama Anthropic claude-haiku-4-5 con el git log capturado en el build,
      genera el changelog en español, crea un registro AppChangelog y actualiza AppVersion
    * Si la última release lleva más de 60 días sin actualizarse: emite aviso de docs obsoletas
    * Envía reporte por email al platform owner al finalizar

VERIFICACIÓN (ejecuta después de configurar)

1. Llama manualmente dailyPermissionAudit con el header x-cron-secret correcto.
   Respuesta esperada: 200 OK con { success: true, businessesScanned: N, ... }

2. Llama manualmente dailyDocumentationAudit con el header x-cron-secret correcto.
   Respuesta esperada: 200 OK con { success: true, snapshotVersion: "2.12.0", ... }

NO HAGAS
- No modifiques el código de las funciones.
- No uses el horario 08:00-09:00 CDMX sin verificar primero qué otros crons de licencia siguen agendados en el panel de Base44 (el ciclo de vida nativo de StockFlow fue retirado — ver `base44/AUTOMATION_SETUP_PROMPT.md` — pero un cron viejo puede seguir agendado ahí hasta que se borre a mano).
- No configures ANTHROPIC_API_KEY_SF si no la tienes; dailyDocumentationAudit degradará
  graciosamente usando los cambios del snapshot en lugar de generarlos con IA.

REPORTA AL TERMINAR
- URLs configuradas y horarios UTC finales
- Resultado de las llamadas de verificación (status code + body resumido)
```

---

## Workflow del desarrollador: mantener los snapshots actualizados

Cada vez que:
- Se añaden, renombran o eliminan **permisos** en `src/lib/permissionRegistry.js`
- Se actualiza `APP_VERSION` o `CHANGELOG` en `src/lib/appConfig.js`

Ejecutar en la raíz del proyecto:

```bash
# Regenera ambos snapshots y actualiza las funciones Deno en un solo paso
npm run generate:all

# O individualmente:
npm run generate:permission-manifests   # → permissionManifests.ts + jobs/handlers/dailyPermissionAudit.ts
npm run generate:version-snapshot       # → versionHistorySnapshot.ts + jobs/handlers/dailyDocumentationAudit.ts
```

Committer los cambios (incluye los archivos `.ts` actualizados en `src/generated/` y
los handlers de `base44/functions/jobs/handlers/`). Base44 desplegará automáticamente en el siguiente push.

---

## Archivos del sistema

| Archivo | Propósito |
|---|---|
| `base44/entities/AppChangelog.jsonc` | Entidad BD para historial de versiones |
| `base44/functions/jobs/handlers/dailyPermissionAudit.ts` | Handler del router `jobs` — cron 09:00 |
| `base44/functions/jobs/handlers/dailyDocumentationAudit.ts` | Handler del router `jobs` — cron 09:15 |
| `scripts/generatePermissionManifests.mjs` | Regenera permisos desde permissionRegistry.js |
| `scripts/generateVersionHistorySnapshot.mjs` | Regenera snapshot de versión desde appConfig.js + git |
| `src/generated/permissionManifests.ts` | Artefacto generado — permisos tipados para el frontend |
| `src/generated/versionHistorySnapshot.ts` | Artefacto generado — snapshot de versión para el frontend |

---

## Flujo end-to-end de la auditoría nocturna

```
09:00 → dailyPermissionAudit
  ├── Business.list() — todos los tenants
  ├── Por cada tenant × rol: filter PermissionProfile
  ├── Crea/actualiza en batches de 50
  └── Email → h.josepablo@gmail.com

09:15 → dailyDocumentationAudit
  ├── AppChangelog.list() — versiones en BD
  ├── ¿Existe entry para SNAPSHOT_VERSION?
  │   ├── SÍ → verificar staleness (> 60 días)
  │   └── NO → Anthropic API (git log + snapshot_changes)
  │           └── AppChangelog.create() + AppVersion.update()
  └── Email → h.josepablo@gmail.com
```

## Llamadores de licenses (ola 4)

`confirmRenewalPayment` y `adminUpdateTenantLicense` siguen invocando la funcion vieja
`sendLifecycleEmails` (no `jobs`). Motivo: `asServiceRole.invoke` no envia `x-cron-secret`
y no esta verificado que la autorizacion de la action de `jobs` se comporte igual que la
de la funcion vieja. Migrarlos solo tras verificarlo en preview con un caso real.
Los rechazos de las actions de `jobs` son 401 (no 403).
