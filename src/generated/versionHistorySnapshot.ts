// AUTO-GENERADO — no editar manualmente.
// Comando: npm run generate:version-snapshot
// Generado: 2026-07-28T20:38:55.376Z

export const SNAPSHOT_VERSION = "2.18.14";

export const SNAPSHOT_RELEASE_DATE = "2026-07-28";

export const USER_MANUAL_LAST_REVIEWED = "2026-07-27";

export const SNAPSHOT_GIT_LOG = "cf5e62c Merge pull request #313 from jospabloh/claude/gifted-turing-7puf7q\ncfcd736 chore: automated security, quality and permissions audit v2.18.13\ncded2ff Update base44 packages\n6936e49 Merge pull request #310 from jospabloh/claude/unmerged-branches-cleanup-xwtflm\n43f5776 chore(deps): remove unused dependencies\n5b3642f Merge pull request #308 from jospabloh/dependabot/github_actions/github-actions-eefdb6dedd\n97b8eae chore(deps): bump actions/setup-node in the github-actions group\nab6eefe Merge pull request #307 from jospabloh/claude/unmerged-branches-cleanup-xwtflm\nf13d2f5 fix(deps): correct dependabot.yml content (was accidentally base64-encoded)\nae406d9 chore(deps): group dependabot updates into a single weekly PR per ecosystem\n2694c98 Merge pull request #293 from jospabloh/automated/release-pr\n22a8e83 Merge remote-tracking branch 'origin/main' into automated/release-pr\n9e7bbd6 Merge pull request #294 from jospabloh/claude/utility-withdrawals-admin-visibility-99f8g4\n01ee5b8 Merge remote-tracking branch 'origin/main' into claude/utility-withdrawals-admin-visibility-99f8g4\nc5f2297 Merge pull request #295 from jospabloh/claude/react-deps-merge-conflict-p8c82n\n48a8ef9 chore(deps): bump react and @types/react to 19.2.7 / 19.2.17\n974e991 Restrict profit withdrawals visibility to admin by default\nc15b926 chore: release and update documentation\n2934e0f Merge pull request #291 from jospabloh/dependabot/npm_and_yarn/multi-3d3f0671f1\n72cfe50 Merge branch 'main' into dependabot/npm_and_yarn/multi-3d3f0671f1\nd10efa1 Merge pull request #290 from jospabloh/dependabot/npm_and_yarn/radix-ui/react-select-2.3.3\nc35e325 Merge branch 'main' into dependabot/npm_and_yarn/radix-ui/react-select-2.3.3\ne927940 chore(deps): bump react-dom and @types/react-dom\nff867b3 Merge pull request #289 from jospabloh/dependabot/npm_and_yarn/radix-ui/react-radio-group-1.4.3\nbcd9184 Merge branch 'main' into dependabot/npm_and_yarn/radix-ui/react-radio-group-1.4.3";

export const SNAPSHOT_LATEST_CHANGES: string[] = [
  "🔒 Re-auditoría de seguridad, calidad, permisos y CI: repo sin cambios desde v2.18.13, todas las correcciones previas siguen vigentes (react-leaflet, jsconfig, permiso Caja Chica:add_fund).",
  "📦 Dependencias: aplicado el subconjunto seguro del bump agrupado de dependabot (#315) — Radix UI, React 19.2.8, @tanstack/react-query, vite, etc. Excluidos de este bump: eslint 10.x (sin release de eslint-plugin-react compatible aún — habría roto `npm ci` igual que react-leaflet) y react-window 2.x (cambio de API rompe el build de VirtualizedProductTable.jsx, que usa `FixedSizeList`).",
  "🛠️ dependabot.yml: agregadas reglas ignore para los mayors de eslint y react-window hasta que el ecosistema/código lo soporte, para no repetir el mismo bump roto cada semana.",
  "🛠️ CI: corregido el workflow 'Auto Release PR' — usaba GITHUB_TOKEN por defecto para abrir su PR, y GitHub no dispara otros workflows sobre eventos autenticados con GITHUB_TOKEN, así que Deno CI nunca corría en esa PR (quedaba 'unstable' para siempre). Ahora usa el secret RELEASE_PR_PAT si existe (fallback a GITHUB_TOKEN mientras no se configure).",
  "🧹 Cerradas PR #314 (release automático, superseded por este cambio de versión) y #315 (bump de dependabot, habría roto el build) con explicación — ver comentarios en cada una.",
];

export const SNAPSHOT_FULL_CHANGELOG: Array<{
  version: string;
  date: string;
  changes: string[];
}> = [
  {
    version: "2.18.14",
    date: "2026-07-28",
    changes: [
    "🔒 Re-auditoría de seguridad, calidad, permisos y CI: repo sin cambios desde v2.18.13, todas las correcciones previas siguen vigentes (react-leaflet, jsconfig, permiso Caja Chica:add_fund).",
    "📦 Dependencias: aplicado el subconjunto seguro del bump agrupado de dependabot (#315) — Radix UI, React 19.2.8, @tanstack/react-query, vite, etc. Excluidos de este bump: eslint 10.x (sin release de eslint-plugin-react compatible aún — habría roto `npm ci` igual que react-leaflet) y react-window 2.x (cambio de API rompe el build de VirtualizedProductTable.jsx, que usa `FixedSizeList`).",
    "🛠️ dependabot.yml: agregadas reglas ignore para los mayors de eslint y react-window hasta que el ecosistema/código lo soporte, para no repetir el mismo bump roto cada semana.",
    "🛠️ CI: corregido el workflow 'Auto Release PR' — usaba GITHUB_TOKEN por defecto para abrir su PR, y GitHub no dispara otros workflows sobre eventos autenticados con GITHUB_TOKEN, así que Deno CI nunca corría en esa PR (quedaba 'unstable' para siempre). Ahora usa el secret RELEASE_PR_PAT si existe (fallback a GITHUB_TOKEN mientras no se configure).",
    "🧹 Cerradas PR #314 (release automático, superseded por este cambio de versión) y #315 (bump de dependabot, habría roto el build) con explicación — ver comentarios en cada una."
    ]
  },
  {
    version: "2.18.13",
    date: "2026-07-27",
    changes: [
    "🔒 Auditoría de seguridad y calidad v2.18.13: 0 hallazgos Críticos o Altos sin resolver o clasificados. Sin cambios en lógica de negocio, precios, impuestos ni datos.",
    "🛠️ CI: eliminada dependencia no utilizada react-leaflet — causaba fallo de npm ci (conflicto de peer dependency con React 19) en el workflow de liberación automática desde el 17 de julio.",
    "🔧 jsconfig.json: corregida opción de compilador obsoleta (baseUrl) que impedía ejecutar la verificación de tipos.",
    "🛡️ Caja Chica: el botón 'Fondo Inicial' ahora respeta el permiso granular Caja Chica:add_fund (ya definido en la matriz, no aplicado en la UI) — almacenista sin el permiso ya no ve la acción, igual que 'Ajuste'.",
    "📦 Dependencias: 4 vulnerabilidades resueltas sin cambios de compatibilidad (dompurify, engine.io-client, postcss, ws).",
    "📦 Vulnerabilidades residuales aceptadas (requieren actualización mayor, evaluación aparte): react-router (CSRF en modo RSC, no usado por esta app), toolchain de eslint (solo desarrollo, no se distribuye a producción). xlsx sigue sin fix upstream disponible (riesgo ya aceptado).",
    "✅ Validación RLS: 29 entidades, 21 con alcance de tenant — sin hallazgos.",
    "📋 Matriz de permisos: 171 claves canónicas — sin brechas nuevas tras cerrar el hallazgo de Caja Chica.",
    "📚 Manual de usuario: nota de permiso agregada al artículo de Caja Chica para reflejar la restricción de 'Fondo Inicial'."
    ]
  },
  {
    version: "2.18.12",
    date: "2026-07-17",
    changes: [
    "Actualización a la versión 2.18.12"
    ]
  },
  {
    version: "2.18.11",
    date: "2026-07-15",
    changes: [
    "Actualización a la versión 2.18.11"
    ]
  },
  {
    version: "2.18.10",
    date: "2026-07-07",
    changes: [
    "Actualización a la versión 2.18.10"
    ]
  },
  {
    version: "2.18.9",
    date: "2026-07-07",
    changes: [
    "Actualización a la versión 2.18.9"
    ]
  },
  {
    version: "2.18.8",
    date: "2026-07-06",
    changes: [
    "🔒 Auditoría de seguridad, calidad y liberación v2.18.8: 0 hallazgos Críticos o Altos. Sin cambios en lógica de negocio, datos ni aislamiento de tenant.",
    "📋 Matriz de permisos actualizada a 169 claves canónicas (+14 nuevas: módulos Cursos, Inscripciones, Campañas y Contactos registrados).",
    "🔧 appConfig.js: compatibilidad con entorno Node.js — import.meta.env protegido con optional chaining para scripts de generación.",
    "📚 Manual de usuario actualizado a v2.18.8 — novedades de sesiones activas, Cursos y módulo de soporte IA documentadas.",
    "🔄 Versión en base de datos (AppVersion) sincronizada con la versión en código.",
    "✅ Validación RLS: 29 entidades, 21 con alcance de tenant — sin hallazgos.",
    "🤖 PR #261 (asistente IA de soporte) preparado para revisión — campo ai_brief desplegado en esquema SupportTicket."
    ]
  },
  {
    version: "2.18.7",
    date: "2026-07-05",
    changes: [
    "📇 Cursos: detalle del contacto muestra el historial de cursos con la edad registrada en cada inscripción.",
    "🎓 Cursos y edades: nueva vista 'Cursos y edades' dentro del perfil de contacto — age_at_enrollment por curso en un solo vistazo."
    ]
  },
  {
    version: "2.18.6",
    date: "2026-07-05",
    changes: [
    "📇 Contactos: ficha de contacto muestra historial de cursos y la edad en cada inscripción."
    ]
  },
  {
    version: "2.18.5",
    date: "2026-07-05",
    changes: [
    "🎓 Cursos: historial de cursos por contacto — age_at_enrollment calculado y almacenado al inscribir.",
    "📚 Manual de usuario actualizado: nuevos artículos de Cursos, Inscripciones y Contactos."
    ]
  },
  {
    version: "2.18.4",
    date: "2026-07-02",
    changes: [
    "🧹 Lint: 5 errores pre-existentes corregidos (imports no utilizados, variables sin referencia).",
    "📦 Dependencias base44 actualizadas a la versión más reciente."
    ]
  },
  {
    version: "2.18.3",
    date: "2026-06-29",
    changes: [
    "🔒 Sesiones activas: AppSession + latido periódico con force-logout y bridge sessions.list/revoke — administra todas las sesiones de un usuario desde un solo panel."
    ]
  },
  {
    version: "2.18.2",
    date: "2026-06-29",
    changes: [
    "🔧 Backend: eliminada función resolveLicenseState que rompía el deploy — resolución de estado de licencia inlineada en adminGetAllLicenses.",
    "🔧 Backend: adminGetAllLicenses evalúa correctamente el estado archived como solo-lectura.",
    "🔒 Seguridad: console.log de depuración eliminado en Settings.jsx (exponía businessId en consola del navegador).",
    "📦 Dependencias: react-quill removida del package.json (sin uso en código fuente, CVE moderada en Quill ≤1.3.7)."
    ]
  },
  {
    version: "2.18.1",
    date: "2026-06-22",
    changes: [
    "🔒 Auditoría de seguridad y calidad v2.18.1: 0 hallazgos Críticos o Altos. Se eliminaron 2 console.log de depuración en el Generador de Códigos de Barras (datos de producto visibles en consola del navegador).",
    "📖 Manual de usuario actualizado: versión y fecha de revisión sincronizadas con la versión actual de la app.",
    "✅ Validación de aislamiento de tenant completada: 22 entidades, 15 con alcance de tenant, todas pasan la validación RLS.",
    "🧹 PR #190 (automatizado / sin cambios reales) cerrado: el PR de liberación automática fue reemplazado por esta revisión manual."
    ]
  },
  {
    version: "2.18.0",
    date: "2026-06-19",
    changes: [
    "🎨 Nueva identidad visual: tipografías Space Grotesk e IBM Plex en toda la app, con cifras monoespaciadas que se alinean en tablas, totales y reportes",
    "📊 Dashboard renovado: nuevo encabezado “Inventario en vivo” con el stock total, el flujo de entradas/salidas del día y la alerta de reposición",
    "🎨 Paleta de marca centralizada (índigo/cian): colores consistentes en toda la aplicación y listos para personalización",
    "🧾 Cotización pública rediseñada: ahora es un documento profesional con el nombre y color de tu negocio, legible con cualquier color de marca y optimizado para celular",
    "♿ Accesibilidad: se respeta la preferencia de “reducir movimiento” del dispositivo y mejora el contraste de color"
    ]
  },
  {
    version: "2.17.6",
    date: "2026-06-19",
    changes: [
    "Actualización a la versión 2.17.6"
    ]
  },
  {
    version: "2.17.5",
    date: "2026-06-19",
    changes: [
    "Actualización a la versión 2.17.5"
    ]
  },
  {
    version: "2.17.4",
    date: "2026-06-19",
    changes: [
    "Actualización a la versión 2.17.4"
    ]
  },
  {
    version: "2.17.3",
    date: "2026-06-17",
    changes: [
    "Actualización a la versión 2.17.3"
    ]
  },
  {
    version: "2.17.2",
    date: "2026-06-17",
    changes: [
    "Actualización a la versión 2.17.2"
    ]
  },
  {
    version: "2.17.1",
    date: "2026-06-16",
    changes: [
    "Actualización a la versión 2.17.1"
    ]
  },
  {
    version: "2.17.0",
    date: "2026-06-15",
    changes: [
    "🛡️ Auditoría de seguridad y permisos: módulo Cuentas de Fondos registrado en la matriz de permisos granulares",
    "🔒 CuentasFondo:view — almacenista puede ver las cuentas; CuentasFondo:create/edit/delete — solo admin por defecto",
    "🚫 La página FundAccounts ahora muestra 'Acceso Restringido' si el rol no tiene el permiso de vista",
    "📋 Matriz de permisos actualizada: 15 módulos, 152 claves (se añaden CuentasFondo:view/create/edit/delete)",
    "📝 Mapa de permisos: FundAccounts → CuentasFondo añadido a permissionModuleMap.js",
    "📚 Manual de usuario revisado y actualizado al 15 de junio de 2026"
    ]
  },
  {
    version: "2.16.17",
    date: "2026-06-08",
    changes: [
    "Actualización a la versión 2.16.17"
    ]
  },
  {
    version: "2.16.16",
    date: "2026-06-08",
    changes: [
    "🛡️ Utilidad y Rubros: los permisos granulares ahora se aplican en el frontend (antes solo estaban registrados en la matriz)",
    "🔒 Utilidad: la página exige el permiso 'Ver Estado de Resultados'; sin él se muestra Acceso Restringido en vez del contenido confidencial",
    "💸 Utilidad: el botón 'Retiro de utilidad' y las acciones de editar/eliminar del historial requieren el permiso 'Registrar Retiro de Utilidad'",
    "📈 Utilidad: el interruptor de Proyección requiere el permiso 'Gestionar proyección'",
    "🏷️ Rubros: la página exige 'Ver lista de rubros'; crear, editar/activar y eliminar requieren sus permisos respectivos",
    "🗺️ Mapa de permisos: la página Utility ahora resuelve correctamente al módulo Utilidad (la visibilidad en el menú lateral respeta el permiso de vista)"
    ]
  },
  {
    version: "2.16.15",
    date: "2026-06-08",
    changes: [
    "🔧 Fix crítico de inventario: el stock se aplica exactamente una vez — resuelve desincronización con clientes de precio cero (Baristop Distribuidora)",
    "🏗️ Movement.stock_applied: nueva marca de idempotencia que garantiza que cada movimiento aplica su delta una sola vez",
    "🔒 applyMovementStock: función única y canónica de autoridad para el delta de stock, con aislamiento de tenant reforzado",
    "🔄 dailyStockReconcile: auditoría nocturna de solo lectura detecta movimientos sin aplicar (red de seguridad)",
    "💰 Retiro de utilidad: modal simplificado — solo pide Monto, Fecha, Fuente (Efectivo/AFIRME), Quién lo tomó y Concepto",
    "🏷️ Estado 'Facturado' (Sí/No): nuevo campo en retiros de utilidad con toggle e insignia visual en el historial",
    "📊 Estado de Resultados refactorizado: distinción clara entre Utilidad Total (generada), Retirada y Disponible",
    "📋 Estado de factura en Pagos a Proveedores: Pendiente / Recibida / No requerida, con filtros y cambio rápido en tabla",
    "🛡️ Matriz de permisos actualizada: módulos Utilidad y Rubros registrados (admin=true, almacenista conserva comportamiento actual)",
    "📚 Manual de usuario revisado y actualizado al 8 de junio de 2026"
    ]
  },
  {
    version: "2.16.14",
    date: "2026-06-05",
    changes: [
    "Actualización a la versión 2.16.14"
    ]
  },
  {
    version: "2.16.13",
    date: "2026-06-05",
    changes: [
    "Actualización a la versión 2.16.13"
    ]
  },
  {
    version: "2.16.12",
    date: "2026-06-04",
    changes: [
    "Actualización a la versión 2.16.12"
    ]
  },
  {
    version: "2.16.11",
    date: "2026-06-04",
    changes: [
    "Actualización a la versión 2.16.11"
    ]
  },
  {
    version: "2.16.10",
    date: "2026-06-04",
    changes: [
    "Actualización a la versión 2.16.10"
    ]
  },
  {
    version: "2.16.9",
    date: "2026-06-04",
    changes: [
    "Actualización a la versión 2.16.9"
    ]
  },
  {
    version: "2.16.8",
    date: "2026-06-03",
    changes: [
    "Actualización a la versión 2.16.8"
    ]
  },
  {
    version: "2.16.7",
    date: "2026-06-03",
    changes: [
    "Actualización a la versión 2.16.7"
    ]
  },
  {
    version: "2.16.6",
    date: "2026-06-03",
    changes: [
    "Actualización a la versión 2.16.6"
    ]
  },
  {
    version: "2.16.5",
    date: "2026-06-03",
    changes: [
    "Actualización a la versión 2.16.5"
    ]
  },
  {
    version: "2.16.4",
    date: "2026-06-03",
    changes: [
    "Actualización a la versión 2.16.4"
    ]
  },
  {
    version: "2.16.3",
    date: "2026-06-03",
    changes: [
    "Actualización a la versión 2.16.3"
    ]
  },
  {
    version: "2.16.2",
    date: "2026-06-03",
    changes: [
    "Actualización a la versión 2.16.2"
    ]
  },
  {
    version: "2.16.1",
    date: "2026-06-02",
    changes: [
    "Actualización a la versión 2.16.1"
    ]
  },
  {
    version: "2.16.0",
    date: "2026-06-02",
    changes: [
    "🔒 Auditoría de seguridad completa: 17 CVEs adicionales resueltos en dependencias npm (package-lock.json actualizado)",
    "🧹 Eliminado workflow CI redundante deno.yml — un solo pipeline Deno CI en ci.yml",
    "🗑️ Eliminado componente muerto ProtectedRoute.jsx: referenciaba authChecked y checkUserAuth inexistentes en AuthContext",
    "📋 Matriz de permisos revisada y confirmada: 13 módulos, 144 claves, admin=true y almacenista=false por defecto",
    "🛡️ Aislamiento de tenant validado: RLS + funciones backend con ownership check activos",
    "📚 Manual de usuario revisado y actualizado al 2 de junio de 2026",
    "📝 Changelog y versión actualizados a v2.16.0"
    ]
  },
  {
    version: "2.15.0",
    date: "2026-06-01",
    changes: [
    "🔒 Auditoría de calidad y seguridad completa del codebase (deps, CI/CD, permisos, arquitectura)",
    "📦 Actualización de dependencias vulnerables: jspdf, axios, lodash, dompurify, vite, ws, flatted (19 CVEs resueltos: 1 crítico, 8 altos, 10 moderados)",
    "🔑 Permisos nuevos: Cotizaciones:share (compartir enlace público) y Configuracion:manage_referral (programa de referidos) — admin=true, almacenista=false por defecto",
    "📋 Manifiestos de permisos regenerados con las nuevas claves v2.14.0",
    "📚 Manual de usuario actualizado: artículos de Compartir Cotización, Programa de Referidos y Onboarding Wizard",
    "📝 Changelog y versión actualizados a v2.15.0"
    ]
  },
  {
    version: "2.14.0",
    date: "2026-06-01",
    changes: [
    "🔐 Auditoría de seguridad completa: eliminación de emails hardcodeados en 36+ archivos del frontend y 25 funciones backend",
    "🔐 Guards de autenticación añadidos a 11 funciones sin auth (platform-owner-only y user-only)",
    "🔐 RLS fix: regla de creación de Business ahora abierta para cualquier usuario autenticado (primer tenant)",
    "🔐 PLATFORM_OWNER_EMAIL ahora se lee exclusivamente de variable de entorno — nunca del código fuente",
    "🔐 Eliminadas 102 funciones scaffold/debug del codebase de producción",
    "🛡️ HelpCenter: admin de plataforma resuelto por isPlatformAdmin del backend, no por email hardcodeado",
    "🔗 Compartir Cotización (Public Link): enlace seguro por token UUID para que clientes acepten/rechacen sin login",
    "💌 Wizard de Onboarding: guía paso a paso para nuevos negocios (Bienvenida → Primer producto → Invitar equipo)",
    "🎁 Programa de Referidos: código único por negocio, +15 días de trial para referente y referido al activar",
    "📊 Panel de Referidos en Configuración: código con botones de copiar y WhatsApp, estadísticas y progreso"
    ]
  },
  {
    version: "2.13.8",
    date: "2026-05-20",
    changes: [
    "Actualización a la versión 2.13.8"
    ]
  },
  {
    version: "2.13.7",
    date: "2026-05-15",
    changes: [
    "Actualización a la versión 2.13.7"
    ]
  },
  {
    version: "2.13.6",
    date: "2026-05-15",
    changes: [
    "Actualización a la versión 2.13.6"
    ]
  },
  {
    version: "2.13.5",
    date: "2026-05-15",
    changes: [
    "Actualización a la versión 2.13.5"
    ]
  },
  {
    version: "2.13.4",
    date: "2026-05-15",
    changes: [
    "Actualización a la versión 2.13.4"
    ]
  },
  {
    version: "2.13.3",
    date: "2026-05-15",
    changes: [
    "Actualización a la versión 2.13.3"
    ]
  },
  {
    version: "2.13.2",
    date: "2026-05-15",
    changes: [
    "Actualización a la versión 2.13.2"
    ]
  },
  {
    version: "2.13.1",
    date: "2026-05-15",
    changes: [
    "Actualización a la versión 2.13.1"
    ]
  },
  {
    version: "2.13.0",
    date: "2026-05-14",
    changes: [
    "🔐 Permisos granulares: política oficial de defaults — Admin inicia con acceso total (true) en todos los módulos, visuales y acciones",
    "👥 Member/Almacenista mantiene acceso operativo; permisos sensibles o nuevos no se elevan automáticamente",
    "🆕 Nuevo módulo, visual o acción: default para member en false hasta otorgamiento explícito por admin",
    "🧩 Matriz de permisos alineada a acciones estándar: view, add, modify, delete",
    "📚 Manual de permisos actualizado con cobertura completa de módulos activos y reglas de gobernanza"
    ]
  },
  {
    version: "2.12.0",
    date: "2026-04-28",
    changes: [
    "📧 Sistema de reactivación de trial: emails automáticos a usuarios inactivos con prueba activa (sin afectar cuentas pagadas, vencidas, archivadas o suspendidas)",
    "⏰ Job diario processTrialReactivationEmails: detecta usuarios inactivos >24 h, respeta límite de 3 emails por trial y mínimo 48 h entre envíos",
    "🔒 Idempotencia garantizada: clave única por usuario/negocio/día previene duplicados aunque el job corra dos veces",
    "🌐 Email bilingüe: plantilla en español (es-MX) e inglés (en-US) según configuración regional del tenant",
    "📊 Rastreo de actividad seguro: hook useActivityTracker + función trackUserActivity con throttle de 15 min; no bloquea UI",
    "🛡️ Tenant isolation preservada: trackUserActivity solo actualiza al usuario autenticado; job lee users filtrados por business_id",
    "📋 Entidad User actualizada: campos last_active_at, last_trial_reactivation_email_at, trial_reactivation_email_count (no rompe campos existentes)",
    "📋 Entidad EmailNotification: nuevo tipo trial_reactivation + campos idempotency_key, user_id, skip_reason para auditoría"
    ]
  },
  {
    version: "2.11.0",
    date: "2026-04-26",
    changes: [
    "💳 Pagos Parciales en Cotizaciones: registra abonos con método de pago, fecha y notas; saldo pendiente en tiempo real",
    "📊 Historial de pagos por cotización: cada abono queda registrado con monto, método, fecha y autor",
    "💰 Saldo pendiente: campos amount_paid y balance reflejan el estado exacto de cobro por cotización",
    "🚨 Alerta de Saldo Pendiente en Dashboard: detecta cotizaciones entregadas con saldo sin cobrar",
    "📦 Entrega segura On-Demand: deliverQuotationSafe valida ítems pendientes antes de marcar como entregado",
    "🔍 On-Demand mejorado: búsqueda y vinculación de producto existente del catálogo al registrar solicitud",
    "📥 Recepción On-Demand: modal rediseñado para registrar cantidad recibida en almacén y actualizar stock",
    "🐛 Fix: entidad User formalizada con campos role y business_id (admin / almacenista)",
    "🐛 Fix: updateQuotationFlagsSafe — corrección en manejo de flags de entrega"
    ]
  },
  {
    version: "2.10.0",
    date: "2026-04-26",
    changes: [
    "🔐 Sistema de Permisos Granulares: gestión de accesos por módulo y acción (ver/leer/escribir/modificar/eliminar) por rol",
    "🛡️ Panel de Permisos exclusivo para administradores: matriz visual de permisos con activación por tenant",
    "⚙️ Regla tenant enable_granular_permissions: permisos granulares desactivados por defecto — cero impacto hasta habilitarse",
    "🔒 PermissionGate: componente de control de acceso a páginas; PermissionContext: estado global de permisos",
    "📋 Cotizaciones por Demanda (On-Demand): nuevo flujo para registrar productos solicitados sin stock previo",
    "🗂️ Panel de Pendientes On-Demand: lista de solicitudes en espera de aprobación o conversión a cotización",
    "👥 Nuevo componente TeamMembersManager: gestión de equipo mejorada con cambio de rol y búsqueda",
    "🔍 Visibilidad de campos configurable por rol: precio de compra, márgenes y datos sensibles ocultos según rol",
    "🐛 Fix: fallos silenciosos en guardado de cotizaciones eliminados — errores ahora visibles con detalle",
    "🐛 Fix: botón 'Guardar' en cotizaciones ya no se bloquea cuando el stock de un producto es 0",
    "🐛 Fix: updateQuotationSafe — whitelist de campos corregida para no descartar campos de contenido"
    ]
  },
  {
    version: "2.9.2",
    date: "2026-04-24",
    changes: [
    "🐛 Fix: carga de Proveedores y Métodos de Pago en Pagos a Proveedores mediante serviceRole — dropdowns ya no quedan vacíos",
    "🐛 Fix: errores de carga de catálogo ahora se muestran como toast en lugar de fallar silenciosamente",
    "🐛 Fix: removido parámetro sort incompatible en filtros de Proveedor y Método de Pago",
    "🐛 Fix: checkbox auto-renovación ahora persiste correctamente al aprobar licencia",
    "🐛 Fix: contraste de dropdowns en panel de licencias — selects correctamente visibles en modo oscuro",
    "🐛 Fix: partición proactiva booleana en adminUpdateTenantLicense — reintentos dirigidos si el SDK descarta campos",
    "🐛 Fix: UX tolerante en panel de licencias — errores de guardado muestran campos específicos que fallaron",
    "📚 Manual reorganizado: artículos de Reportes, Configuración y Caja Chica movidos de Novedades a sus secciones permanentes",
    "📚 Nuevos artículos: Pagos a Proveedores, Auditoría de Inventario, Ciclo de Vida de Cuentas, Múltiples Contactos por Proveedor"
    ]
  },
  {
    version: "2.9.1",
    date: "2026-04-22",
    changes: [
    "💳 Nuevo módulo 'Pagos a Proveedores': registro y seguimiento de desembolsos a proveedores con perfil por proveedor",
    "📊 Dashboard mejorado: nueva sección de Pagos a Proveedores con gráfico de período y top 5 proveedores",
    "💰 Análisis de Ventas actualizado: línea de Pagos a Proveedores + nueva línea Utilidad Neta con badge de impacto",
    "📈 Reports: nueva pestaña de Pagos a Proveedores con gráfico acumulativo y KPIs vs período anterior",
    "🔗 Toggle de Caja Chica: en Pagos a Proveedores, opción de sincronizar pago con egreso de Caja Chica (generated_by_system)",
    "🔍 Búsqueda mejorada: Select de Proveedor ahora usa SearchableSelect con filtro en tiempo real (nombre de negocio + contacto)",
    "🔍 Búsqueda mejorada: Select de Método de pago ahora usa SearchableSelect; botón X reemplaza opción '— Ninguno —'",
    "📱 Búsqueda inteligente: toggle de Caja Chica solo aparece cuando el método es 'Efectivo', se resetea al cambiar método",
    "🎨 Layout del Dashboard optimizado: grid 2-col desde md (tablets ahora ven side-by-side), eliminado whitespace innecesario",
    "📊 Semáforo de Cotizaciones mejorado: tasa de conversión % + barra de progreso proporcional + enlace 'Ver todas'",
    "🌓 Dark mode mejorado: colores de gráficos ahora reaccionan al cambio de tema en tiempo real (CartesianGrid, axes, tooltip)",
    "🧹 Lint: resuelto 31 warnings ESLint no-unused-vars + 54 imports no utilizados removidos"
    ]
  },
  {
    version: "2.9.0",
    date: "2026-04-21",
    changes: [
    "🔍 Nueva pestaña 'Audit Inventario' en Configuración: detecta discrepancias entre stock actual y movimientos registrados",
    "🗂️ Clasificación automática de discrepancias: direct_edit, sync_error, no_movements, legacy_bug con badges visuales",
    "✅ Resolución de auditoría: el admin puede aceptar stock actual o revertirlo al valor calculado con movimiento de reconciliación",
    "📧 Sistema de ciclo de vida de cuentas con emails automáticos en español: bienvenida, aviso de expiración, modo solo-lectura y archivo",
    "🔄 Transiciones automáticas gestionadas por scheduler diario: trial → view_only → archived → deleted",
    "☑️ Checkbox de auto-renovación por tenant en panel de administración de licencias",
    "👥 Múltiples contactos por proveedor: contacto principal obligatorio + contactos adicionales opcionales",
    "🔒 Campos obligatorios en formulario de cliente: Nombre de Contacto, Nombre de Negocio y Teléfono",
    "🐛 Fix: scroll y max-height en diálogo Editar Licencia — ya no se corta en pantallas pequeñas",
    "🐛 Fix: badge de stock bajo en sidebar se refresca correctamente al navegar entre páginas",
    "🐛 Fix: emails de ciclo de vida ahora se envían via Core.SendEmail nativo de base44 (sin dependencia de Resend)"
    ]
  },
  {
    version: "2.8.2",
    date: "2026-04-15",
    changes: [
    "🎯 Centro de Ayuda ahora filtra artículos según las reglas activas del tenant en tiempo de ejecución",
    "📄 Nuevo artículo tenant-facing para la regla cash_sales_to_petty_cash: explicación operativa sin exponer arquitectura de plataforma",
    "🛡️ Artículos de administración de plataforma (Reglas por Tenant) visibles únicamente para el administrador de plataforma",
    "🔍 Artículos con visibility_scope='tenant_rule' visibles solo cuando required_rule_key está habilitado para ese negocio",
    "⚡ Carga paralela de helpData + user + getCurrentTenantRuleMap en HelpCenter para rendimiento óptimo"
    ]
  },
  {
    version: "2.8.1",
    date: "2026-04-15",
    changes: [
    "🛡️ Nuevo módulo de administración de plataforma: Reglas por Tenant con gestión segura (listar, crear, editar, habilitar/deshabilitar y archivar)",
    "🏛️ Navegación administrativa reorganizada: sección Sistema con acceso exclusivo para plataforma a Licencias y Reglas por Tenant",
    "⚙️ Nueva entidad TenantRule para excepciones operativas por negocio con soporte de config_json, notas y trazabilidad de cambios",
    "🔐 Nuevas funciones backend platform-admin-only: adminListTenantRules, adminUpsertTenantRule, adminDeleteTenantRule y getCurrentTenantRuleMap",
    "💸 Integración de regla tenant cash_sales_to_petty_cash: ingresos de caja chica generados por servidor, trazables por origen y sin duplicados",
    "🔄 Reconciliación automática de caja chica en cambios de pago/cancelación/eliminación para mantener consistencia sin hardcodes por tenant",
    "📘 Manual actualizado con artículo de Reglas por Tenant y lineamientos de uso administrativo"
    ]
  },
  {
    version: "2.8.0",
    date: "2026-04-15",
    changes: [
    "✨ Nueva función opcional por tenant: ventas en efectivo cobradas se registran automáticamente como ingresos en Caja Chica",
    "🔒 Característica activable individualmente por negocio mediante bandera de configuración — sin efecto en otros tenants",
    "🔗 Cada ingreso generado automáticamente queda vinculado a su origen (cotización o movimiento directo) con metadatos trazables",
    "🔄 Reversión automática: si se cancela o revierte la venta de origen, el ingreso en caja chica se elimina de forma segura",
    "🛡️ Idempotencia garantizada: nunca se genera más de un ingreso por la misma transacción de origen",
    "🔐 Registros generados por el sistema marcados como protegidos en Caja Chica — no editables ni eliminables directamente",
    "⚡ Confirmación de pago en movimientos directos ahora pasa por función de backend segura con soporte de caja chica",
    "📋 Schema de Caja Chica actualizado: nuevos campos origin_type, origin_id, generated_by_system, payment_method_snapshot",
    "📋 Schema de Negocio actualizado: nuevo campo de bandera de función auto_cash_income_to_petty_cash (false por defecto)"
    ]
  },
  {
    version: "2.7.3",
    date: "2026-04-13",
    changes: [
    "🐛 Regla de stock bajo unificada en los 3 puntos de visualización (campana, Dashboard, Products?filter=low_stock): un producto cuenta como stock bajo SOLO si status=active, min_stock es numérico y explícito, y stock <= min_stock",
    "🚫 Productos inactivos excluidos de todas las alertas de stock bajo",
    "🚫 Productos con min_stock null/undefined/inválido NO se cuentan como stock bajo",
    "✅ Conteo idéntico garantizado: campana = tarjeta Dashboard = filtro Products stock bajo"
    ]
  },
  {
    version: "2.7.2",
    date: "2026-04-13",
    changes: [
    "🔧 Fix lint: variable 'response' en QuotationFormDialog elevada a let antes del bloque if/else para resolver error no-undef"
    ]
  },
  {
    version: "2.7.1",
    date: "2026-04-13",
    changes: [
    "🔒 Corrección crítica de resolución de tenant en licencias: la función getCurrentTenantLicenseState ahora resuelve estrictamente el negocio por el business_id exacto del usuario autenticado",
    "🛡️ Guard hard implementado: si el negocio resuelto no coincide con el business_id del usuario autenticado, la función falla de forma segura sin retornar datos de otro tenant",
    "🔗 URL de upgrade corregida: los banners de prueba y modo solo lectura ahora apuntan a la página comercial correcta https://www.acaciaco.com.mx/stockflow",
    "🧹 Limpieza: funciones y componentes de debug temporal removidos del codebase"
    ]
  },
  {
    version: "2.7.0",
    date: "2026-04-11",
    changes: [
    "🌟 Sistema completo de licencias por tenant: prueba de 30 días, planes Start/Growth/Pro, modo solo lectura al expirar",
    "🔒 Panel de administración de licencias exclusivo para administradores de plataforma (/LicenseAdmin)",
    "⚠️ Banner de prueba y modo solo lectura visible en todo momento según estado del tenant",
    "🛡️ Protección de escritura en backend (12 funciones): ningún tenant en view_only puede crear, editar ni eliminar datos",
    "⏰ Job automático diario: expira trials vencidos y los transicióna a modo solo lectura",
    "🏛️ Grandfather: tenants existentes sin estado de licencia tratados como activos automáticamente"
    ]
  },
  {
    version: "2.6.2",
    date: "2026-04-09",
    changes: [
    "🔧 Corrección crítica: las acciones de guardar en formularios de edición (productos, clientes, cotizaciones, movimientos, categorías, proveedores) ahora completan la persistencia correctamente en todos los dispositivos y condiciones de sesión",
    "⚡ Mejora de robustez en backend: las funciones de escritura ahora utilizan asServiceRole para las operaciones finales de persistencia, previniendo fallos silenciosos causados por tokens de sesión expirados o condiciones de autenticación temporales",
    "✅ SDK de backend actualizado a 0.8.24 en todas las funciones críticas de escritura",
    "🎉 Nueva confirmación visual de éxito: al completar una operación de guardado exitosa se muestra un efecto de celebración para confirmar de forma inequívoca que los cambios fueron persistidos"
    ]
  },
  {
    version: "2.5.8",
    date: "2026-04-09",
    changes: [
    "📱 Corrección de accesibilidad de botones de acción en iOS: dialogs de edición de productos, cotizaciones y clientes ahora usan dvh en lugar de vh para el cálculo de altura máxima, garantizando que el footer con los botones Guardar/Cancelar siempre sea visible y alcanzable en iPhone",
    "📱 Corrección de padding inferior en footers de dialogs: se aplica env(safe-area-inset-bottom) para que los botones de acción nunca queden ocultos bajo la barra de navegación inferior en dispositivos con notch o home indicator"
    ]
  },
  {
    version: "2.5.7",
    date: "2026-04-09",
    changes: [
    "🔧 Corrección de resolución de precios por cliente en movimientos: el precio ahora aplica correctamente las reglas configuradas del cliente (precio de compra forzado o precio de mayoreo forzado), en lugar de ignorarlas",
    "🔧 Corrección de consistencia de inventario: el stock de un producto ahora se sincroniza correctamente con el historial de movimientos cuando existe discrepancia entre el campo de stock y el último movimiento registrado",
    "📱 Corrección de accesibilidad del botón de guardar en pantallas pequeñas: el footer del formulario de movimientos ahora siempre es visible y alcanzable en dispositivos móviles",
    "📱 Corrección de comportamiento de viewport en iOS: configuración actualizada para evitar zoom involuntario por gesto de pellizco que causaba comportamiento inesperado en modo PWA instalada"
    ]
  },
  {
    version: "2.5.6",
    date: "2026-04-08",
    changes: [
    "🔒 Gestión de sesión basada en inactividad real (Idle Timeout): la sesión ya no expira mientras el usuario esté navegando o trabajando activamente",
    "⏱️ Aviso de inactividad: tras 20 minutos sin actividad aparece un aviso con cuenta regresiva de 2 minutos antes de cerrar la sesión",
    "✅ El usuario puede retomar la sesión con un clic — si ignora el aviso, se muestra el diálogo de sesión expirada con opción de renovar o salir",
    "🛡️ Heartbeat de sesión inteligente: solo se envía mientras el usuario está activo — sin llamadas innecesarias cuando la app está en segundo plano"
    ]
  },
  {
    version: "2.5.5",
    date: "2026-04-07",
    changes: [
    "🔄 Semáforo de cotizaciones ahora filtra a últimos 30 días: muestra conteo actualizado de cotizaciones concretadas, en ruta y entregadas de este período",
    "🚨 Nueva alerta de Cobranza Vencida: identifica cotizaciones concretadas sin cobrar que están fuera de los 30 días y requieren seguimiento urgente",
    "📊 Etiqueta añadida al semáforo: especifica 'En los últimos 30 días' para claridad en los datos mostrados"
    ]
  },
  {
    version: "2.5.4",
    date: "2026-04-07",
    changes: [
    "✨ Corrección crítica de navegación en mobile: la barra inferior de navegación ahora es siempre clickeable, incluso con preview de cotización abierto (z-index 70 + pointer-events-auto)",
    "Dialog de cotización mejorado: scroll interno sin bloquear página, permite navegar a otros módulos sin cerrar manualmente",
    "Navegación fluida: usuario puede cambiar entre Dashboard, Productos, Movimientos y Cotizaciones sin trabarse en preview"
    ]
  },
  {
    version: "2.5.3",
    date: "2026-04-07",
    changes: [
    "🔧 Corrección de scroll en tablas de Cotizaciones y Productos: el contenedor ahora permite hacer scroll correctamente en desktop (max-h 70vh con overflow-y-auto)",
    "Header fijo en tablas: el encabezado de columnas permanece visible al hacer scroll gracias a sticky top-0 funcionando correctamente"
    ]
  },
  {
    version: "2.5.2",
    date: "2026-04-07",
    changes: [
    "🗓️ Corrección del filtro de período 'Semana' en Dashboard: ahora muestra correctamente el rango desde el lunes de la semana actual hasta hoy (ej. 01/04/2026 – 07/04/2026)",
    "🌍 Zona horaria corregida: el cálculo de semana usa Intl.DateTimeFormat con America/Mexico_City respetando horario de verano (CDT = UTC-5 en verano, CST = UTC-6 en invierno)",
    "El indicador de rango de fechas en el toggle de período ahora siempre refleja el rango correcto para cada período seleccionado"
    ]
  },
  {
    version: "2.5.1",
    date: "2026-04-07",
    changes: [
    "🔧 Corrección de navegación post-guardado: guardar un producto, movimiento o cotización ya no redirige al dashboard — el usuario regresa a la pantalla anterior con contexto, filtros y posición de scroll preservados",
    "🌍 Configuración regional y zona horaria: nueva sección 'Región y Zona Horaria' en Configuración → Negocio para seleccionar tu país/zona horaria",
    "Zona horaria configurable: 14 opciones incluyendo México (CDMx, Monterrey, Tijuana, Cancún), EE.UU., Colombia, Perú, Chile, Argentina, Brasil, España y UTC",
    "Formato regional configurable: 8 opciones de idioma/fecha (es-MX, es-CO, es-AR, pt-BR, en-US, etc.)",
    "Nueva librería dateUtils.js: todas las fechas del sistema (filtros 'hoy', semana, mes, rangos) se calculan usando la zona horaria configurada",
    "Botones de diálogo mobile mejorados: corregido safe area en iOS para que acciones de formularios nunca queden ocultas bajo la barra de navegación inferior"
    ]
  },
  {
    version: "2.5.0",
    date: "2026-04-06",
    changes: [
    "🎯 Restructuración de navegación: nuevo menú padre 'Catálogos' en sidebar que agrupa 5 catálogos operativos",
    "Catálogos submenu: Productos, Categorías, Proveedores, Clientes, Tipo de pago — cada uno como página independiente",
    "Extracción de gestión de catálogos desde Configuración: Categorías, Proveedores, Clientes, Tipo de pago ahora son módulos autónomos y accesibles",
    "Configuración simplificada: eliminadas pestañas de catálogos duplicadas, solo opciones de negocio, fiscales, equipo, importación e informes",
    "Menú Acerca de renombrado correctamente: label en sidebar es 'Acerca de' (no StockFlow), página interna muestra 'StockFlow' como nombre de producto",
    "Protección de layout en cotizaciones PDF: corrección de espacio de dirección larga para evitar colisiones con código de folio",
    "Text wrapping mejorado: direcciones largas en cotizaciones se desglosan correctamente sin superponer números de folio",
    "Responsive integrity validado: todas las nuevas páginas de catálogos funcionales en iPhone y Android sin botones ocultos",
    "Integridad de datos preservada: CRUD de catálogos, permisos, business_id isolation, y tenant aislamiento completamente intactos"
    ]
  },
  {
    version: "2.4.4",
    date: "2026-04-06",
    changes: [
    "Nueva configuración de transporte para clientes con precio de compra forzado: +20 MXN por producto automáticamente",
    "En formulario de cliente: mostrar '20 MXN transporte/producto' cuando force_purchase_all_products = true",
    "En cotización: icono 🚚 en cada línea de producto cuando el cliente tiene transporte aplicado",
    "Actualizado pricing engine: suma de +20 MXN por producto SOLO para clientes con force_purchase = true",
    "Campo en UI cliente mejorado con alerta visual del transporte aplicado"
    ]
  },
  {
    version: "2.4.3",
    date: "2026-04-06",
    changes: [
    "Corrección definitiva de cálculo de IVA en cotizaciones: productos con IVA 16% desglosan el impuesto contenido (÷1.16), productos Excento (IVA 0%) no se desglosan",
    "Mejora de visibilidad: labels actualizados de 'IVA' a 'IVA 16%' y '0%' a 'Excento' para claridad",
    "Indicador de configuración cliente: ahora muestra badge pequeño 'Compra' o 'Mayoreo' debajo del label de IVA cuando el cliente tiene configuración forzada",
    "Total a pagar = suma directa (sin modificaciones), IVA desglosado solo para información, nunca se suma al total"
    ]
  },
  {
    version: "2.4.2",
    date: "2026-04-06",
    changes: [
    "🔥 Corrección crítica: los precios del catálogo son precios finales (con o sin IVA según aplique) — NO se suma IVA adicional en cotización",
    "Cambio importante: el sistema solo muestra un desglose informativo del IVA incluido para visibilidad, pero el total = suma directa de precios sin añadir nada más",
    "Mejora de contraste: total en cotizaciones ahora visible correctamente en tema claro y oscuro"
    ]
  },
  {
    version: "2.4.1",
    date: "2026-04-06",
    changes: [
    "Intento anterior: cálculo de IVA en cotizaciones — causó doble conteo de impuestos en Baristop",
    "Raíz del problema identificada: asumimos que los precios eran SIN IVA, cuando en realidad el cliente proporciona precios YA finales"
    ]
  },
  {
    version: "2.4.0",
    date: "2026-04-06",
    changes: [
    "Función de corrección de cotizaciones: nueva función backend checkAndFixQuotation para anular o eliminar cotizaciones erradas",
    "Si la cotización está en Borrador → se elimina; si está Concretada → se hace rollback automático (restaura stock, crea movimientos de devolución)",
    "Función lista para producción tras identificar que COT-260406-0002 no existía en BD (cliente no la había guardado)"
    ]
  },
  {
    version: "2.3.0",
    date: "2026-04-03",
    changes: [
    "Nueva función: Devolución Parcial en cotizaciones concretadas — selecciona productos y cantidades devueltas, restaura stock automáticamente y ajusta el total de la cotización",
    "Flujo corregido: ya no es necesario cancelar + recrear cotizaciones para devoluciones parciales; para devolución total se usa 'Cancelar' con razón",
    "Opción 'Devolución parcial' disponible en el menú ⋯ de cualquier cotización con estado Concretada"
    ]
  },
  {
    version: "2.2.0",
    date: "2026-04-03",
    changes: [
    "Corrección crítica de IVA en cotizaciones: los precios ya incluyen IVA — ahora el sistema extrae el impuesto del total en lugar de sumarlo (evita doble conteo)",
    "Corrección de folio: la secuencia de folios ahora comienza correctamente desde 0001 (antes empezaba en 0000)",
    "Corrección manual aplicada a COT-260403-0000 para reflejar los valores correctos de IVA"
    ]
  },
  {
    version: "2.1.0",
    date: "2026-04-02",
    changes: [
    "Corrección: nombre del negocio ahora se muestra correctamente en la barra lateral (se resolvía con SDK autenticado en lugar de backend function)",
    "Eliminado duplicado del nombre del negocio en el sidebar — ahora aparece una sola vez bajo 'StockFlow'",
    "Reset y carga de datos de prueba para ACACIA OWNER SANDBOX: 10 productos, 4 categorías, 2 proveedores, 4 clientes, 12 movimientos, 4 cotizaciones y 4 movimientos de caja chica"
    ]
  },
  {
    version: "2.0.0",
    date: "2026-04-01",
    changes: [
    "🔮 Capa Predictiva/Inteligente de Reportes (solo Admin/Owner): 8 reportes con lógica determinística interna",
    "Análisis Dinámico/Pivot: agrupación multi-dimensional (producto/categoría/cliente × mes/semana/día) con múltiples agregaciones",
    "Más Vendidos: ranking de productos por valor de ventas con barras de progreso",
    "Baja Rotación: productos con menor movimiento en período seleccionado",
    "Tendencia: gráfico dual de entradas/salidas con líneas de evolución diaria",
    "Riesgo de Agotamiento: predicción de días restantes de stock basada en promedio de 30 días",
    "Sugerencia de Resurtido: cálculo automático de cantidades recomendadas con urgencia (crítica/alta/media)",
    "Riesgo de Cobranza: puntuación determinística de riesgo por edad, monto y estado de entrega",
    "Discrepancias/Anomalías: 5 reglas determinísticas para detectar irregularidades operativas",
    "Acceso restringido: capa predictiva invisible para Sales/Warehouse/Storekeeper",
    "Sin integraciones externas: todo cálculo es interno, sin uso de créditos de integración"
    ]
  },
  {
    version: "1.8.0",
    date: "2026-04-01",
    changes: [
    "Nueva pestaña 'Movimientos de Stock' en Reportes disponible para Almacenistas: historial detallado con filtro por tipo",
    "Nueva pestaña 'Predicción Inteligente de Pedidos' (solo Admin): alerta 🔴/🟡/🟢 por semanas de stock disponibles según historial de ventas",
    "Almacenistas requieren razón obligatoria al eliminar categorías de catálogo",
    "Settings ahora carga catálogos operativos para Almacenistas (no solo Admin)",
    "Reportes: la pestaña por defecto para Almacenista ahora abre 'Movimientos de Stock'",
    "Centro de Ayuda actualizado v2.4: artículos sobre reportes operativos, predicción de pedidos y eliminación con razón"
    ]
  },
  {
    version: "1.7.0",
    date: "2026-04-01",
    changes: [
    "Auditoría y mejora de sección Reports para operaciones de distribuidor",
    "Pestaña 'Más Vendidos' rediseñada: ahora ordena por valor de ventas (no solo cantidad) con barra de progreso",
    "Pestaña 'Baja Rotación' mejorada: tabla con contexto de stock actual, mínimo y fecha de última salida",
    "Nueva pestaña 'Inventario Actual' (admin): listado completo de stock con valor unitario y valor total por producto",
    "Pestaña 'Mejor Margen' removida: datos infiables (schema usa retail_sale_price/wholesale_sale_price, no sale_price)",
    "Pestaña 'Por Categoría' removida: bajo valor operativo (reemplazada por Inventario Actual más útil)",
    "Mejora de contraste en modo oscuro: números y valores ahora más visibles en Dashboard y Reports"
    ]
  },
  {
    version: "1.6.0",
    date: "2026-04-01",
    changes: [
    "Cálculo automático de impuestos en movimientos: el total incluye el IVA (tax_rate) del producto",
    "Etiqueta actualizada en Dashboard: 'Cobrado' en lugar de 'Venta real (menos pendiente)'",
    "Visibilidad por rol en Dashboard: almacenista ve 'Monto vendido' y 'Cobrado'; admin ve además 'Costo de lo vendido' y 'Ganancia bruta'"
    ]
  },
  {
    version: "1.5.0",
    date: "2026-04-01",
    changes: [
    "Toggle 'Pago recibido' en el formulario de salidas directas para registrar el cobro en el momento",
    "Columna 'Pago' en la tabla de Movimientos: badge Pendiente (clickeable) y Cobrado para salidas directas",
    "Alerta de cobros pendientes en el Dashboard unificada: suma cotizaciones concretadas sin pagar + salidas directas sin cobrar",
    "Desglose de la alerta: indica cuántas son de cotizaciones y cuántas de movimientos directos"
    ]
  },
  {
    version: "1.4.0",
    date: "2026-03-31",
    changes: [
    "Botón de seguimiento unificado en cotizaciones: un solo dropdown 'Ruta' con opciones En Ruta / Entregado / Quitar estado",
    "Indicador visual de alerta (rojo pulsante '¡Cobrar!') para pedidos entregados sin cobrar en la tabla de cotizaciones",
    "Reportes: filas 'Entregado sin cobrar' resaltadas en rojo con etiqueta de alerta para facilitar seguimiento de cobranza"
    ]
  },
  {
    version: "1.3.0",
    date: "2026-03-31",
    changes: [
    "Campo 'Giro' agregado a clientes: visible en tabla, formulario e importación CSV",
    "Dropdowns de Cliente y Forma de Pago con búsqueda en tiempo real en formulario de movimientos",
    "Nuevo componente SearchableSelect reutilizable para selects buscables en toda la app",
    "Mejoras de visibilidad en botón de eliminar movimientos para administradores"
    ]
  },
  {
    version: "1.2.0",
    date: "2026-03-28",
    changes: [
    "Formas de pago configurables desde Configuración (Pagos), compartidas en movimientos y cotizaciones",
    "Eliminación segura de movimientos con reversión automática de stock",
    "Mejoras de contraste y legibilidad en el formulario de movimientos (total visible en modo oscuro)"
    ]
  },
  {
    version: "1.1.0",
    date: "2026-03-27",
    changes: [
    "Nuevo esquema de precios por producto: precio menudeo, mayoreo y cantidad mínima para mayoreo",
    "Jerarquía de precios por cliente: opciones para aplicar precio mayoreo o precio de compra en todos los productos",
    "Importación actualizada de productos con nuevas columnas de precios",
    "Nueva importación masiva de clientes desde CSV",
    "Nueva importación masiva de categorías desde CSV",
    "Corrección de visibilidad y contraste en la sección de importación (tema oscuro)"
    ]
  },
  {
    version: "1.0.0",
    date: "2026-01-15",
    changes: [
    "Lanzamiento inicial de StockFlow",
    "Módulos de productos, movimientos, cotizaciones, caja chica y reportes",
    "Control multi-tenant con aislamiento por negocio",
    "Soporte para tema oscuro y modo PWA"
    ]
  },
];
