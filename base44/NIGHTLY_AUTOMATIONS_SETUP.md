# Automatizaciones Nocturnas StockFlow — Setup

> **Ola 4 (router `jobs`)**: todas las tareas programadas viven ahora en la función `jobs`
> (`POST /functions/v1/jobs`, body `{"action": "<nombre>"}`, mismo header `x-cron-secret`).
> Actions: `sendLifecycleEmails`, `processTrialReactivationEmails`, `dailyPermissionAudit`,
> `dailyDocumentationAudit`, `dailyStockReconcile`, `cleanupSessions`. Workflows en repo:
> Los 4 workflows del repo (Daily Stock Reconcile, Send Lifecycle Emails, Trial Reactivation Emails Daily,
> Weekly Permission Audit) apuntan a `jobs`. Las funciones sueltas viejas ya NO existen (borradas en ola 4b): cualquier cron HTTP del
> panel que aun apunte a `/functions/v1/<nombre viejo>` debe repuntarse a `/functions/v1/jobs` con el body de arriba.
> `cleanupSessions` existe como action pero NO
> se programa: decisión del owner tras medir el impacto (>1000 sesiones viejas, cross-tenant). `dailyDocumentationAudit` escribe datos
> (AppChangelog / AppVersion) y NO se programa desde el repo: sigue como cron HTTP del panel
> (actualizar su URL/body según el prompt de abajo). `dailyPermissionAudit` (escribe PermissionProfile)
> SÍ se programa desde el repo, semanal: workflow `Weekly Permission Audit` (lunes 13:00 UTC, `0 13 * * 1`).
> NO crear además un cron HTTP del panel para ella (duplicaría escrituras y correos); si existe uno, desactivarlo.
> Recordatorios de cursos: cron del panel -> `/functions/v1/courseComms`, body `{"action":"runReminders"}`
> (reemplaza al wrapper `sendCourseReminders`).

Este documento contiene el **prompt exacto** para configurar el cron job nocturno de
`dailyDocumentationAudit` en Base44 (`dailyPermissionAudit` ya NO va por cron del panel: lo corre el workflow semanal del repo), y los pasos de verificación post-deploy.

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
Necesito que configures un cron job nocturno adicional en este proyecto Base44.

CONTEXTO
- StockFlow es un SaaS multi-tenant de gestión de inventario.
- Las funciones ya están desplegadas como Deno edge functions.
- Los cron deben llamar las funciones via HTTP POST con header
  `x-cron-secret: <valor de CRON_SECRET>` para autorización.
- El CRON_SECRET ya está configurado como variable de entorno.

CRON — dailyDocumentationAudit
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

1. Llama manualmente dailyDocumentationAudit con el header x-cron-secret correcto.
   Respuesta esperada: 200 OK con { success: true, snapshotVersion: "2.12.0", ... }

NO HAGAS
- No modifiques el código de las funciones.
- No configures un cron de dailyPermissionAudit: la programa el workflow `Weekly Permission Audit` del repo (lunes 13:00 UTC).
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
| `base44/functions/jobs/handlers/dailyPermissionAudit.ts` | Handler del router `jobs` — workflow semanal (lunes 13:00 UTC) |
| `base44/functions/jobs/handlers/dailyDocumentationAudit.ts` | Handler del router `jobs` — cron 09:15 |
| `scripts/generatePermissionManifests.mjs` | Regenera permisos desde permissionRegistry.js |
| `scripts/generateVersionHistorySnapshot.mjs` | Regenera snapshot de versión desde appConfig.js + git |
| `src/generated/permissionManifests.ts` | Artefacto generado — permisos tipados para el frontend |
| `src/generated/versionHistorySnapshot.ts` | Artefacto generado — snapshot de versión para el frontend |

---

## Flujo end-to-end de la auditoría nocturna

```
lunes 13:00 UTC → dailyPermissionAudit (workflow del repo)
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

## Llamadores de licenses (ola 4b)

`confirmRenewalPayment` (`asServiceRole.functions.invoke('jobs', { action: 'sendLifecycleEmails', jobs })`) y
`adminUpdateTenantLicense` (`fetch /functions/v1/jobs` con `x-cron-secret` + `Authorization` y body
`{ action: 'sendLifecycleEmails', jobs }`) despachan al router `jobs`. El handler es el mismo codigo de la
funcion vieja (misma autenticacion: x-cron-secret o platform owner). Prueba: `base44/tests/licenses_to_jobs_route_test.ts`.
Los rechazos de las actions de `jobs` son 401 (no 403).
