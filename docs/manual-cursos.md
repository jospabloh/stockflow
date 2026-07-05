# Manual de usuario — Módulo Cursos

> Guía para el administrador del negocio (tenant). Explica **qué es cada pantalla,
> campo y botón** del módulo de Cursos, para qué sirve y cómo usarlo.
>
> Última actualización: 2026-07-05. Mantén este documento al día cada vez que
> cambie una pantalla o se agregue un campo.

---

## 1. ¿Qué es el módulo de Cursos?

Es el módulo para gestionar tus **cursos y talleres** de principio a fin:

- **Contactos** — el directorio de personas interesadas (asistentes, prospectos).
- **Cursos** — el catálogo de cursos/talleres, con sesiones, precios y cupo.
- **Calendario** — todas las sesiones de tus cursos en una vista de mes.
- **Inscripciones** — quién se inscribió a qué curso y en qué estatus (interesado
  → confirmado → pagado → asistió), con su pago y sus datos.
- **Campañas y avisos** — mandar correos o WhatsApp a un segmento de contactos o
  a los inscritos de un curso.

**Cómo se conecta todo:**

```
Contacto  ──se inscribe a──▶  Curso (con sus sesiones)
   │                              │
   │                              └──▶ aparece en el Calendario
   │
   └──▶ Inscripción (estatus + pago + edad + motivo)
   │
   └──▶ recibe Campañas / avisos / confirmaciones
```

Un mismo **contacto** puede tener **varias inscripciones** (varios cursos, en
distintos momentos). Los datos del asistente que cambian con el tiempo —como la
**edad**— se guardan en la **inscripción**, no en el contacto, para que queden
registrados tal como eran en cada curso.

---

## 2. Contactos

**Para qué sirve:** el directorio de personas interesadas en tus cursos,
campañas y avisos. Aquí registras a cualquiera antes de inscribirlo.

### Tarjetas de resumen (arriba)
| Tarjeta | Qué cuenta |
|---|---|
| **Contactos** | Total de contactos registrados. |
| **Activos** | Contactos con estado "Activo". |
| **Etiquetas** | Cuántas etiquetas distintas existen entre todos los contactos. |
| **Desde cursos** | Contactos cuyo origen es "Curso". |

### Tabla de contactos
Columnas: **Nombre**, **Teléfono**, **Email**, **Origen**, **Etiquetas**,
**Estado** y **Acciones**. Usa el buscador de arriba para filtrar por nombre,
email, teléfono o etiqueta.

**Botones de cada fila (Acciones):**
- 🎓 **Historial de cursos** — abre la línea de tiempo de cursos de ese contacto
  (ver sección 2.2). El número en el ícono indica cuántos cursos ha llevado.
- ✏️ **Editar** — abre el formulario del contacto.
- 🗑️ **Eliminar** — borra el contacto (pide confirmación implícita; no se puede
  deshacer).

### 2.1 Formulario de contacto (Nuevo / Editar)
| Campo | Qué es | Ejemplo |
|---|---|---|
| **Nombre** * | Nombre de la persona. Obligatorio. | María López |
| **Teléfono** | Número para WhatsApp. Sin él no puedes mandarle WhatsApp. | 5512345678 |
| **Email** | Correo para confirmaciones y campañas por correo. | maria@correo.com |
| **Origen** | De dónde llegó el contacto: Instagram, WhatsApp, Curso, Referido, Cliente, Otro. | Instagram |
| **Estado** | Activo o Inactivo. Los inactivos se excluyen de las campañas por etiqueta. | Activo |
| **Ciudad** | Ciudad de la persona (opcional). | Puebla |
| **Instagram** | Usuario de Instagram (opcional). | @maria |
| **Etiquetas / intereses** | Etiquetas para segmentar (escribe y Enter, o toca una sugerida). Se usan en campañas. | matcha, barista |
| **Vincular a cliente** | Asociar el contacto a un Cliente existente (opcional). | — |
| **Notas** | Texto libre. | Prefiere sábados |

### 2.2 Historial de cursos del contacto (🎓)
Abre una **línea de tiempo** con todos los cursos en los que se ha inscrito esa
persona, ordenados por fecha. Sirve para responder: *"¿qué cursos llevó y qué
edad tenía en cada uno?"*

- El **medallón** de cada punto muestra la **edad** que tenía la persona en ese
  curso. Si no se capturó edad, el medallón muestra un ícono y la tarjeta dice
  "Edad no registrada".
- Cada tarjeta muestra: **nombre del curso**, **periodo** (fecha(s) de la sesión
  o la fecha de inscripción), **estatus** de la inscripción y lo **pagado**.
- El encabezado resume: cuántos cursos y el **rango de edades** (ej. "3 cursos ·
  de 26 a 28 años").

> La edad se captura en la **Inscripción** (sección 5). Si no aparece aquí, es
> porque esa inscripción no tiene edad capturada.

---

## 3. Cursos

**Para qué sirve:** el catálogo de tus cursos y talleres. Cada curso guarda sus
sesiones (fechas/horas), precios, cupo y datos del instructor.

### Tarjetas de resumen
| Tarjeta | Qué cuenta |
|---|---|
| **Cursos** | Total de cursos creados. |
| **Publicados** | Cursos con estado "Publicado". |
| **Próxima sesión** | La fecha de la siguiente sesión agendada (de cualquier curso no cancelado). |

### Tarjeta de cada curso
Muestra el título, instructor/marca, la **próxima sesión**, el **rango de precios**,
el **cupo** ("N lugares"), el número de temas y la ubicación, más su **estado**
(Borrador / Publicado / Completado / Cancelado). Botones: ✏️ Editar y 🗑️ Eliminar.

### 3.1 Formulario de curso (Nuevo / Editar)
| Campo | Qué es | Ejemplo |
|---|---|---|
| **Nombre del curso** * | Título. Obligatorio. | Curso para Barista |
| **Descripción** | Texto general del curso. | Módulo teórico-práctico… |
| **Ubicación / modalidad** | Dónde se imparte. | Baristop / En tu cafetería |
| **Estado** | Borrador (no listo), Publicado (visible), Completado, Cancelado. Los cancelados no aparecen en el calendario. | Publicado |
| **Instructor** | Nombre de quien imparte. | Alex Barista |
| **Marca / invitado** | Marca o invitado asociado. | Prado Café |
| **Cupo máximo** | Máximo de asistentes. Se usa en Inscripciones para avisar cuando se llena. | 4 |
| **Precio persona extra (MXN)** | Costo por persona adicional (opcional). | 500 |
| **Costo del curso (MXN)** | Lo que a ti te cuesta impartirlo. Sirve para calcular el **margen**. | 1200 |
| **Margen** (calculado) | Se muestra solo: precio de venta más bajo − costo. Verde si es positivo, rojo si es negativo. | Margen: $1,300 |
| **Temario** | Lista de temas (escribe y Agregar). | Métodos de extracción |
| **Incluye** | Lista de lo que incluye (insumos, manual, kit…). | Manual y libreta |
| **Precios** | Una o más opciones de precio. **Una opción = precio único; dos o más = por modalidad** (etiqueta + monto). | En nuestra cafetería · $2,500 |
| **Sesiones** | Una o varias fechas con hora de inicio/fin y una nota. **Aparecen en el Calendario.** | 2026-08-15 · 10:00–14:00 · "Módulo 1" |
| **URL del flyer** | Enlace a la imagen promocional (opcional). | https://… |
| **Notas internas** | Texto libre, no visible para el asistente. | — |

> **Importante:** el margen se calcula con el **precio de venta más bajo** de las
> opciones de precio y el **costo del curso**. Si no capturas ambos, verás el
> texto de ayuda en lugar del margen.

---

## 4. Calendario

**Para qué sirve:** ver **todas las sesiones** de tus cursos en una vista de mes.

- Navega con **‹ / ›** entre meses y con **Hoy** para volver al mes actual.
- Cada día muestra hasta 2 sesiones (con su hora) y "+N más" si hay más.
- El día de **hoy** se marca con un círculo de color.
- **Toca un día** para ver abajo el detalle de sus sesiones: curso, horario,
  nota, ubicación e instructor.
- Los cursos **Cancelados** no se muestran.

El calendario es **solo de lectura**: las sesiones se crean/editan desde el
formulario del **Curso** (sección 3.1).

---

## 5. Inscripciones

**Para qué sirve:** llevar el seguimiento de **quién se inscribió a qué curso**,
su estatus, su pago y sus datos. Es el corazón del módulo.

### Tarjetas de resumen
| Tarjeta | Qué cuenta |
|---|---|
| **Inscripciones** | Total de inscripciones. |
| **Confirmadas** | Estatus confirmado, pagado o asistió. |
| **Asistieron** | Estatus "asistió". |
| **Cobrado** | Suma de todo lo pagado. |

### Filtros y cupo
Arriba puedes filtrar por **Curso** y por **Estatus**. Si eliges un curso con
cupo definido, aparece un indicador **N / N cupo** (verde si hay lugar, rojo si
está lleno).

### Tabla de inscripciones
Columnas: **Contacto** (con su teléfono), **Curso**, **Modalidad** (con el
precio), **Pers.** (personas), **Estatus**, **Pagado** y **Acciones**.

- La columna **Pagado** también muestra el **apartado** (si hay) y un **badge de
  factura** cuando el estatus de factura no es "No requiere".
- El **Estatus** se puede cambiar en línea desde el menú desplegable de la fila.

**Botones de cada fila (Acciones):**
- ✈️ **Enviar** — abre un menú para mandar **Confirmación** o **Recordatorio**,
  por **Correo** o por **WhatsApp** (ver sección 6).
- **Detalle** — abre el formulario de la inscripción para editar todos sus datos.
- 🗑️ **Eliminar** — borra la inscripción.

### 5.1 Formulario de inscripción (Nueva / Detalle)
Al crear, primero eliges **Curso** y **Contacto**. En "Detalle" (editar) esos
dos ya están fijos y solo cambias los datos.

| Campo | Qué es | Ejemplo |
|---|---|---|
| **Curso** * | El curso al que se inscribe. Solo al crear. | Curso para Barista |
| **Contacto** * | La persona. Búscala por nombre o teléfono. Solo al crear. | María López |
| **Modalidad / precio** | Si el curso tiene opciones de precio, eliges una; si no, capturas etiqueta y monto libres. | En nuestra cafetería · $2,500 |
| **Personas** | Cuántas personas cubre esta inscripción (para persona extra). | 1 |
| **Estatus** | Interesado → Confirmado → Pagado → Asistió (o No asistió / Cancelado). | Confirmado |
| **Pagado (MXN)** | Monto ya pagado. | 2500 |
| **Forma de pago** | Texto libre. | Transferencia |
| **Apartado / anticipo (MXN)** | Monto que dejó apartado antes de pagar completo. | 500 |
| **Factura** | Estado de facturación: **No requiere · Requiere · Facturada**. | Requiere |
| **Motivo de asistencia** | Por qué tomó el curso: crecer profesionalmente, montar/mejorar negocio, gusto/hobby, regalo, recomendación, **otro**. | Montar o mejorar un negocio |
| **¿Cuál motivo?** | Aparece solo si el motivo es "otro"; detalle libre. | Me lo pidió mi jefe |
| **Edad** | Edad del participante en este curso (número exacto). Se ve luego en el historial del contacto. | 28 |
| **Notas** | Texto libre. | — |

> **La edad se guarda por inscripción**, no en el contacto. Así, si la persona
> vuelve a tomar otro curso el año siguiente, registras su nueva edad sin perder
> la anterior. Todo el historial se ve desde **Contactos → 🎓 Historial de
> cursos** (sección 2.2).

---

## 6. Confirmaciones y recordatorios

Desde la tabla de **Inscripciones**, el botón ✈️ **Enviar** de cada fila permite
avisar al asistente por dos vías:

- **Por correo** — envía automáticamente el correo (confirmación o recordatorio).
  Requiere que el contacto tenga **email**. Se marca la fecha de envío en la
  inscripción.
- **Por WhatsApp** — abre WhatsApp Web/app con el **mensaje ya escrito** (no se
  envía solo; tú das "enviar"). Requiere que el contacto tenga **teléfono**. No
  usa ninguna API de pago: es el enlace `wa.me` con el texto precargado.

Hay dos tipos de mensaje:
- **Confirmación** — para confirmar el lugar tras inscribirse.
- **Recordatorio** — para recordar la sesión próxima.

> **Recordatorios automáticos (opcional):** existe una tarea programada
> (`sendCourseReminders`) que puede mandar recordatorios por correo antes de la
> sesión. Se activa desde el panel de Base44; si no está activa, siempre puedes
> mandar los recordatorios a mano con el botón ✈️.

---

## 7. Campañas y avisos

**Para qué sirve:** mandar un mensaje masivo por **correo** o **WhatsApp** a un
segmento de contactos o a los inscritos de un curso.

### Cómo armar una campaña (columna izquierda)
| Campo | Qué es |
|---|---|
| **Nombre interno** | Etiqueta para identificar la campaña en el historial (opcional). |
| **Audiencia** | **Contactos (por etiqueta)** o **Inscritos de un curso**. |
| **Etiquetas** | (Audiencia = contactos) Filtra por etiqueta. Vacío = todos los activos. |
| **Curso** + **Filtrar por estatus** | (Audiencia = curso) Elige el curso y opcionalmente el estatus (confirmados, pagados, etc.). |
| **Canal** | **Correo** o **WhatsApp (uno por uno)**. |
| **Asunto** | (Solo correo) Asunto del email. |
| **Mensaje** | El texto. Usa `{{nombre}}` para personalizar con el nombre del contacto. |

### Enviar (columna derecha)
- Muestra un resumen: cuántos **destinatarios**, cuántos **con correo** y cuántos
  **con teléfono**.
- **Correo:** botón **Enviar N correo(s)** — se mandan de una vez.
- **WhatsApp:** aparece la lista de contactos con teléfono; **tocas cada uno**
  para abrir WhatsApp con el mensaje precargado (uno por uno, tú das enviar).

### Historial de campañas
Abajo se listan las campañas **por correo** enviadas, con su audiencia, fecha y
cuántos se enviaron / fallaron. (Las de WhatsApp no se registran porque se envían
manualmente desde tu teléfono.)

> Necesitas permiso de **enviar campañas**. Si no lo tienes, verás un aviso y el
> botón estará deshabilitado.

---

## 8. Permisos

Cada pantalla respeta los permisos del rol del usuario (módulo → acción):
**Contactos**, **Cursos**, **Inscripciones**, **Campañas**. Por ejemplo, un rol
sin permiso de *crear* en Cursos no ve el botón "Nuevo curso"; sin *enviar* en
Campañas no puede mandar campañas. El administrador del negocio (tenant) tiene
todos los permisos.

Todos los datos están **aislados por negocio** (multi-tenant): cada quien solo ve
y edita lo suyo.

---

## 9. Dudas comunes (FAQ)

**Capturé un dato y al recargar se borró.**
Suele ser un campo que existe en el código pero no en el esquema desplegado en
Base44 (Base44 lo descarta en silencio). Si pasa, avisa a tu desarrollador para
que **despliegue el esquema** (`update_entity_schema`). Ver
`CLAUDE.md` del repo.

**No veo un campo/pantalla nueva.**
Casi siempre es **caché del navegador** o que aún no se publicó el frontend.
Recarga con **Ctrl/Cmd + Shift + R** o abre en ventana de incógnito. Si sigue,
falta correr el deploy del sitio (`npm run build && npx base44 site deploy -y`).

**¿Dónde pongo la edad del asistente?**
En la **Inscripción** (Inscripciones → Nueva/Detalle → campo **Edad**). Luego se
ve por persona en **Contactos → 🎓 Historial de cursos**.

**¿El WhatsApp se manda solo?**
No. Abre WhatsApp con el mensaje **precargado** y tú das enviar. Es gratis (no usa
API de WhatsApp Business).

**Un curso no aparece en el calendario.**
Revisa que tenga **sesiones con fecha** y que **no esté Cancelado**.

---

## 10. Notas para el equipo técnico

- **Entidades:** `Course`, `Enrollment`, `Contact`, `Campaign` (esquemas en
  `base44/entities/*.jsonc`). Recuerda **desplegar** los esquemas a Base44 tras
  cualquier cambio de campo.
- **Funciones backend:** `courses`, `enrollments`, `contacts`, `courseComms`
  (correos/campañas) y la tarea `sendCourseReminders`.
- **Frontend (pantallas):** `src/components/courses/CoursesManager.jsx`,
  `CoursesCalendar.jsx`, `EnrollmentsManager.jsx`, `CampaignsManager.jsx` y
  `src/components/settings/ContactsManager.jsx`.
- **Deploy:** `npm run build && npx base44 site deploy -y` (frontend);
  `npx base44 functions deploy [nombres]` (funciones);
  esquemas vía `update_entity_schema`.
