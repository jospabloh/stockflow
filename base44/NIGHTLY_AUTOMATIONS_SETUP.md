# Automatizaciones Nocturnas StockFlow — Setup

Este documento contiene el **prompt exacto** para configurar los dos cron jobs nocturnos
en Base44, y los pasos de verificación post-deploy.

---

## Variables de entorno requeridas

Configúralas en Base44 → Settings → Environment Variables **antes** de crear los crons:

| Variable | Descripción |
|---|---|
| `CRON_SECRET` | Cadena aleatoria ≥32 chars. Genera con `openssl rand -hex 32`. Mismo valor ya usado por `checkAccountLifecycle` y `processMonthlyRenewal`. |
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
- URL: ${APP_URL}/functions/v1/dailyPermissionAudit
- Headers:
    Content-Type: application/json
    x-cron-secret: ${CRON_SECRET}
- Body: {}
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
- URL: ${APP_URL}/functions/v1/dailyDocumentationAudit
- Headers:
    Content-Type: application/json
    x-cron-secret: ${CRON_SECRET}
- Body: {}
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
- No uses el mismo horario que checkAccountLifecycle (08:00) ni processMonthlyRenewal (09:00 si ya existe).
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
npm run generate:permission-manifests   # → permissionManifests.ts + dailyPermissionAudit
npm run generate:version-snapshot       # → versionHistorySnapshot.ts + dailyDocumentationAudit
```

Committer los cambios (incluye los archivos `.ts` actualizados en `src/generated/` y
los `entry.ts` de las funciones). Base44 desplegará automáticamente en el siguiente push.

---

## Archivos del sistema

| Archivo | Propósito |
|---|---|
| `base44/entities/AppChangelog.jsonc` | Entidad BD para historial de versiones |
| `base44/functions/dailyPermissionAudit/entry.ts` | Función Deno — cron 09:00 |
| `base44/functions/dailyDocumentationAudit/entry.ts` | Función Deno — cron 09:15 |
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
