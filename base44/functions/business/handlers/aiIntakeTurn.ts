import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { hasPermission } from './_permissions.ts';

// aiIntakeTurn — one turn of the support intake interview (the "BA/PO" that
// questions a requester before a ticket is escalated).
//
// Why this lives on the server: it used to call `base44.integrations.Core.InvokeLLM`
// straight from the browser (`src/lib/aiIntake.js`), which means anyone holding a
// session could run arbitrary prompts on the app's LLM credits. Here the prompt,
// the response schema and the question cap are fixed server-side; the client only
// sends the conversation (subject, description, Q/A history), length-capped.
//
// No billing gate on purpose: a suspended/view_only tenant must still be able to
// reach support.

const APP_CONTEXT = {
  name: 'StockFlow',
  domain:
    'SaaS multi-tenant de inventario y punto de venta para comercios: catálogo ' +
    'de productos, control de stock y movimientos de almacén, ventas y punto de ' +
    'venta, cotizaciones, clientes, proveedores y pagos a proveedores, caja chica ' +
    'y cuentas de fondos, reportes, y administración de licencia y permisos.',
  modules: [
    'Productos y catálogo', 'Inventario y movimientos', 'Ventas / punto de venta',
    'Cotizaciones', 'Clientes', 'Proveedores', 'Pagos a proveedores',
    'Categorías y rubros', 'Reportes', 'Caja chica y cuentas de fondos',
    'Métodos de pago', 'Cursos e inscripciones', 'Campañas', 'Admin y permisos',
    'Mi licencia', 'Configuración',
  ],
};

// Keep in sync with MAX_QUESTIONS in src/lib/aiIntake.js (the client uses it only
// for its progress label; this one is the enforced cap).
const MAX_QUESTIONS = 6;

const KIND_LABEL: Record<string, string> = { feature: 'nueva funcionalidad / mejora', bug: 'reporte de incidencia' };

function sanitize(text: unknown = '') {
  return String(text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{S}\n]/gu, '')
    .trim()
    .slice(0, 4000);
}

const TURN_SCHEMA = {
  type: 'object',
  properties: {
    done: { type: 'boolean' },
    question: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        hint: { type: 'string' },
        suggestions: { type: 'array', items: { type: 'string' } },
      },
    },
    brief: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['feature', 'bug'] },
        title: { type: 'string' },
        summary: { type: 'string' },
        affected_area: { type: 'string' },
        user_story: { type: 'string' },
        acceptance_criteria: { type: 'array', items: { type: 'string' } },
        scope_in: { type: 'array', items: { type: 'string' } },
        scope_out: { type: 'array', items: { type: 'string' } },
        repro_steps: { type: 'array', items: { type: 'string' } },
        expected_behavior: { type: 'string' },
        actual_behavior: { type: 'string' },
        severity: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
        impact: { type: 'string' },
        priority_suggestion: { type: 'string', enum: ['low', 'normal', 'high'] },
        open_questions: { type: 'array', items: { type: 'string' } },
      },
      required: ['kind', 'title', 'summary'],
    },
  },
  required: ['done'],
};

function systemPreamble(kind: string) {
  return `Eres un Analista de Negocio (BA) y Product Owner (PO) experto que atiende la mesa de soporte de "${APP_CONTEXT.name}".
Dominio de la app: ${APP_CONTEXT.domain}
Módulos/pantallas: ${APP_CONTEXT.modules.join(', ')}.

Estás atendiendo un caso de tipo: ${KIND_LABEL[kind] || kind}.

Tu objetivo: entrevistar al solicitante (que NO es técnico) con preguntas claras y
breves, UNA A LA VEZ, para reunir todo lo necesario y que un desarrollador pueda
pasar directo a DISEÑAR e IMPLEMENTAR sin volver a preguntar.

Reglas de la entrevista:
- Habla en español mexicano, cálido y concreto. Nada de tecnicismos.
- Una sola pregunta por turno. Que sea la de mayor valor según lo que ya sabes.
- No repitas lo que el usuario ya respondió. No hagas preguntas obvias ni de relleno.
- Ofrece 2-4 "suggestions" como respuestas rápidas cuando aplique (ej. pantallas, opciones).
- Para NUEVA FUNCIONALIDAD, cubre: quién lo necesita (rol), qué quiere lograr y para qué
  (beneficio/negocio), en qué pantalla/módulo, con qué datos/reglas, casos límite, y cómo
  sabrá que quedó bien (criterios de aceptación). Define alcance (incluye / NO incluye).
- Para INCIDENCIA, cubre: pasos exactos para reproducir, qué esperaba vs qué pasó, en qué
  pantalla/módulo, desde cuándo, a cuántos afecta, si hay mensaje de error o folio, y
  severidad/impacto en la operación.
- Cierra la entrevista (done=true) en cuanto tengas lo suficiente para un brief accionable,
  sin exceder ${MAX_QUESTIONS} preguntas. Antes de eso, done=false con la siguiente pregunta.
- Al cerrar, entrega el brief completo y bien redactado (title, summary, criterios, etc.).
  Redacta user_story como "Como <rol>, quiero <capacidad>, para <beneficio>".
  Deja en open_questions lo que quede pendiente de validar con el negocio.`;
}

function conversationBlock(subject: string, description: string, history: Array<{ question?: unknown; answer?: unknown }>) {
  const lines = [
    `Asunto: ${sanitize(subject)}`,
    `Descripción inicial del solicitante: ${sanitize(description)}`,
    '',
    'Entrevista hasta ahora:',
  ];
  if (!history.length) lines.push('(aún no has hecho preguntas)');
  for (const turn of history) {
    lines.push(`P (tú): ${sanitize(turn?.question)}`);
    lines.push(`R (solicitante): ${sanitize(turn?.answer)}`);
  }
  return lines.join('\n');
}

export async function handle(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.business_id) return Response.json({ error: 'Forbidden: no business_id' }, { status: 403 });
    // Each turn spends LLM credits: only callers allowed to open a ticket may run the interview.
    if (!(await hasPermission(base44.asServiceRole, user, 'Centro de Soporte', 'create'))) {
      return Response.json({ error: 'Forbidden: missing permission', permission: 'Centro de Soporte:create' }, { status: 403 });
    }

    const body = await req.json();
    const kind = body?.kind === 'bug' ? 'bug' : 'feature';
    const subject = String(body?.subject || '');
    const description = String(body?.description || '');
    // Anything past the cap is dropped, never sent to the model: the history is
    // the only part of the prompt the caller controls in size.
    const history = Array.isArray(body?.history) ? body.history.slice(0, MAX_QUESTIONS) : [];
    const forceClose = history.length >= MAX_QUESTIONS;

    const prompt = `${systemPreamble(kind)}

${conversationBlock(subject, description, history)}

${forceClose
    ? 'Ya alcanzaste el máximo de preguntas: cierra ahora (done=true) y entrega el brief con lo que tengas.'
    : 'Decide: ¿te falta información clave? Si sí, done=false y formula la SIGUIENTE pregunta. Si ya es suficiente, done=true y entrega el brief.'}

Responde SOLO el JSON del esquema.`;

    // deno-lint-ignore no-explicit-any
    const out: any = (await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
      response_json_schema: TURN_SCHEMA,
    })) || { done: false };

    if (out.done && out.brief) {
      out.brief.kind = out.brief.kind || kind;
      return Response.json({ done: true, brief: out.brief });
    }
    if (!forceClose && out.question && out.question.text) {
      return Response.json({ done: false, question: out.question });
    }
    // Degenerate answer (or a question past the cap) → minimal brief from what we have.
    return Response.json({
      done: true,
      brief: {
        kind,
        title: sanitize(subject) || 'Solicitud de soporte',
        summary: sanitize(description),
        open_questions: ['La IA no pudo estructurar el caso; revisar con el solicitante.'],
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
