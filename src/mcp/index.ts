/**
 * Servidor MCP (stdio) para Claude Desktop.
 * No toca la base de datos: traduce cada herramienta a la API local de la app,
 * así las reglas del día (techo de 8, validaciones) son las mismas que en la UI.
 */
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const CONNECTION_PATH =
  process.env.DAYLIOS_CONNECTION ??
  join(homedir(), 'Library', 'Application Support', 'daily-os', 'connection.json')

const NOT_RUNNING = 'DayliOS no está abierto. Ábrelo desde el menubar y vuelve a intentarlo.'

/** Llama a la API local. Lee la conexión en cada llamada: la app puede haber reiniciado. */
async function api(method: string, path: string, body?: object): Promise<unknown> {
  let connection: { port: number; token: string }
  try {
    connection = JSON.parse(readFileSync(CONNECTION_PATH, 'utf8'))
  } catch {
    throw new Error(NOT_RUNNING)
  }

  let res: Response
  try {
    res = await fetch(`http://127.0.0.1:${connection.port}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${connection.token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new Error(NOT_RUNNING)
  }

  const data = (await res.json()) as { error?: string }
  if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)
  return data
}

/** Envuelve una llamada como resultado de herramienta MCP. */
async function tool(run: () => Promise<unknown>): Promise<{
  content: { type: 'text'; text: string }[]
  isError?: boolean
}> {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await run(), null, 2) }] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { content: [{ type: 'text', text: message }], isError: true }
  }
}

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Fecha local YYYY-MM-DD')

const query = (params: Record<string, string | number | boolean | undefined>): string => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

const server = new McpServer({ name: 'daylios', version: '1.0.0' })

server.registerTool(
  'get_day',
  {
    description:
      'Tareas de un día y su resumen: total, hechas, pendientes, huecos libres y techo (8). Sin fecha = hoy.',
    inputSchema: { date: day.optional() }
  },
  ({ date }) => tool(() => api('GET', `/day${query({ date })}`))
)

server.registerTool(
  'get_history',
  {
    description:
      'Historial agrupado por día (más reciente primero), paginado. Filtra por periodo con from/to inclusivos.',
    inputSchema: {
      from: day.optional(),
      to: day.optional(),
      page: z.number().int().min(1).optional(),
      page_size: z
        .number()
        .int()
        .min(1)
        .max(60)
        .optional()
        .describe('Días por página (7 por defecto)')
    }
  },
  ({ from, to, page, page_size }) =>
    tool(() => api('GET', `/history${query({ from, to, page, pageSize: page_size })}`))
)

server.registerTool(
  'create_task',
  {
    description:
      'Crea una tarea. Sin fecha = hoy. Falla si el día ya tiene 8 tareas. ' +
      'El título admite markdown en línea; la descripción, markdown completo. ' +
      'Tags y esfuerzo: en el título ("Propuesta Acme #ventas !alto") o con tags / effort.',
    inputSchema: {
      title: z.string().min(1).max(200),
      date: day.optional(),
      description: z.string().max(20000).optional().describe('Markdown'),
      tags: z.array(z.string()).max(5).optional().describe('Sin #, minúsculas'),
      effort: z.enum(['alto', 'medio', 'bajo']).optional()
    }
  },
  (args) => tool(() => api('POST', '/tasks', args))
)

server.registerTool(
  'update_task',
  {
    description:
      'Edita el título, la descripción (markdown; cadena vacía la borra), los tags (lista completa), ' +
      'el esfuerzo (null lo quita) y/o marca una tarea como hecha (done: true) o pendiente (done: false).',
    inputSchema: {
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(20000).optional(),
      tags: z.array(z.string()).max(5).optional(),
      effort: z.enum(['alto', 'medio', 'bajo']).nullable().optional(),
      done: z.boolean().optional()
    }
  },
  ({ id, ...fields }) => tool(() => api('PATCH', `/tasks/${encodeURIComponent(id)}`, fields))
)

server.registerTool(
  'delete_task',
  {
    description: 'Elimina una tarea de forma permanente.',
    inputSchema: { id: z.string() }
  },
  ({ id }) => tool(() => api('DELETE', `/tasks/${encodeURIComponent(id)}`))
)

server.registerTool(
  'move_task',
  {
    description: 'Mueve una tarea a otro día (queda al final y recuerda su día de origen).',
    inputSchema: { id: z.string(), date: day }
  },
  ({ id, date }) => tool(() => api('POST', `/tasks/${encodeURIComponent(id)}/move`, { date }))
)

server.registerTool(
  'carry_over_pending',
  {
    description:
      'Mueve las tareas NO completadas de un día a otro mientras haya hueco (techo 8). ' +
      'Por defecto de ayer a hoy. Para preparar mañana al final del día usa from = hoy, to = mañana. ' +
      'Devuelve las movidas y las que no cupieron.',
    inputSchema: { from: day.optional(), to: day.optional() }
  },
  ({ from, to }) => tool(() => api('POST', '/carry-over', { from, to }))
)

// ---- Notas ----

server.registerTool(
  'list_notes',
  {
    description:
      'Notas agrupadas por día de creación (más reciente primero), paginadas por días. ' +
      'Cada nota trae title (su primera línea), excerpt y body en markdown.',
    inputSchema: {
      page: z.number().int().min(1).optional(),
      page_size: z.number().int().min(1).max(60).optional().describe('Días por página (7)')
    }
  },
  ({ page, page_size }) => tool(() => api('GET', `/notes${query({ page, pageSize: page_size })}`))
)

server.registerTool(
  'get_note',
  {
    description: 'Una nota completa por id.',
    inputSchema: { id: z.string() }
  },
  ({ id }) => tool(() => api('GET', `/notes/${encodeURIComponent(id)}`))
)

server.registerTool(
  'create_note',
  {
    description: 'Crea una nota en markdown. La primera línea es el título (p. ej. "# Reunión").',
    inputSchema: { body: z.string().min(1).max(100000) }
  },
  ({ body }) => tool(() => api('POST', '/notes', { body }))
)

server.registerTool(
  'update_note',
  {
    description: 'Reemplaza el contenido completo de una nota (markdown).',
    inputSchema: { id: z.string(), body: z.string().max(100000) }
  },
  ({ id, body }) => tool(() => api('PATCH', `/notes/${encodeURIComponent(id)}`, { body }))
)

server.registerTool(
  'delete_note',
  {
    description: 'Elimina una nota de forma permanente.',
    inputSchema: { id: z.string() }
  },
  ({ id }) => tool(() => api('DELETE', `/notes/${encodeURIComponent(id)}`))
)

// ---- Consultora: clientes, proyectos, reuniones, pipeline ----
// Las referencias (client, project, prospect, stage) aceptan id o nombre.

const ref = (what: string): z.ZodString => z.string().min(1).describe(`id o nombre ${what}`)
const enc = encodeURIComponent

server.registerTool(
  'get_overview',
  {
    description:
      'Panorama de la consultora en una llamada: clientes activos con proyectos y entregables pendientes, ' +
      'action items abiertos, pipeline por etapa, próximos pasos de venta y últimas reuniones. ' +
      'Úsala primero para preguntas generales ("¿cómo vamos?", "¿qué tengo pendiente?").',
    inputSchema: {}
  },
  () => tool(() => api('GET', '/consultora/overview'))
)

server.registerTool(
  'get_client',
  {
    description:
      'Ficha completa de un cliente: datos, contactos, notas, proyectos (con entregables pendientes), reuniones, ' +
      'action items abiertos y lista de documentos de su carpeta. Para "¿en qué está el cliente X?".',
    inputSchema: { client: ref('del cliente') }
  },
  ({ client }) => tool(() => api('GET', `/consultora/clients/${enc(client)}`))
)

server.registerTool(
  'list_clients',
  {
    description: 'Lista de clientes con nº de proyectos activos y fecha de la última reunión.',
    inputSchema: { status: z.enum(['activo', 'historico']).optional() }
  },
  ({ status }) => tool(() => api('GET', `/consultora/clients${query({ status })}`))
)

server.registerTool(
  'get_project',
  {
    description:
      'Proyecto: estado, objetivo, entregables (markdown con casillas) y los pendientes, notas y reuniones. ' +
      'Para "¿en qué está el proyecto X?" o "¿qué entregables faltan?".',
    inputSchema: { project: ref('del proyecto') }
  },
  ({ project }) => tool(() => api('GET', `/consultora/projects/${enc(project)}`))
)

server.registerTool(
  'list_meetings',
  {
    description:
      'Reuniones por día (más reciente primero), sin textos largos. Filtra por cliente, proyecto, prospecto o fechas. ' +
      'Luego usa get_meeting para el detalle.',
    inputSchema: {
      client: z.string().optional(),
      project: z.string().optional(),
      prospect: z.string().optional(),
      from: day.optional(),
      to: day.optional(),
      page: z.number().int().min(1).optional()
    }
  },
  (args) => tool(() => api('GET', `/consultora/meetings${query(args)}`))
)

server.registerTool(
  'get_meeting',
  {
    description:
      'Una reunión: resumen ejecutivo, decisiones, action items, participantes, notas y ruta de la grabación. ' +
      'Para "¿qué se acordó en la última reunión?". include_transcript=true añade la transcripción completa (larga).',
    inputSchema: { id: z.string(), include_transcript: z.boolean().optional() }
  },
  ({ id, include_transcript }) =>
    tool(() =>
      api('GET', `/consultora/meetings/${enc(id)}${include_transcript ? '?transcript=1' : ''}`)
    )
)

server.registerTool(
  'list_action_items',
  {
    description:
      'Action items de todas las reuniones (o de un cliente). Por defecto solo los abiertos.',
    inputSchema: { client: z.string().optional(), done: z.boolean().optional() }
  },
  ({ client, done }) =>
    tool(() =>
      api('GET', `/consultora/action-items${query({ client, done: done ? 'true' : undefined })}`)
    )
)

server.registerTool(
  'get_pipeline',
  {
    description:
      'Pipeline de ventas: etapas en orden con sus prospectos (valor, próximo paso, fecha) y totales.',
    inputSchema: {}
  },
  () => tool(() => api('GET', '/consultora/pipeline'))
)

server.registerTool(
  'get_prospect',
  {
    description: 'Un prospecto con su etapa, notas, próximo paso y reuniones de venta.',
    inputSchema: { prospect: ref('del prospecto (empresa)') }
  },
  ({ prospect }) => tool(() => api('GET', `/consultora/prospects/${enc(prospect)}`))
)

server.registerTool(
  'list_documents',
  {
    description:
      'Archivos de la carpeta de un cliente (contratos, entregables, documentación, grabaciones).',
    inputSchema: { client: ref('del cliente') }
  },
  ({ client }) => tool(() => api('GET', `/consultora/clients/${enc(client)}/documents`))
)

server.registerTool(
  'read_document',
  {
    description:
      'Lee un archivo de texto (.md, .txt, .csv, .json) de la carpeta de un cliente. path = ruta relativa de list_documents.',
    inputSchema: { client: ref('del cliente'), path: z.string() }
  },
  ({ client, path }) =>
    tool(() => api('GET', `/consultora/clients/${enc(client)}/documents/read${query({ path })}`))
)

server.registerTool(
  'search',
  {
    description:
      'Busca un texto en clientes, proyectos, reuniones (incluidas transcripciones) y prospectos. ' +
      'Devuelve tipo, id, título y un fragmento.',
    inputSchema: { query: z.string().min(2) }
  },
  ({ query: q }) => tool(() => api('GET', `/consultora/search${query({ q })}`))
)

server.registerTool(
  'save_client',
  {
    description:
      'Crea un cliente (sin "client") o edita uno existente ("client" = id o nombre). ' +
      'Crear también crea su carpeta de documentos. Campos markdown: contactsMd, notesMd.',
    inputSchema: {
      client: z.string().optional(),
      name: z.string().optional(),
      sector: z.string().optional(),
      status: z.enum(['activo', 'historico']).optional(),
      contactsMd: z.string().optional(),
      notesMd: z.string().optional(),
      signedAt: day.optional()
    }
  },
  ({ client, ...fields }) =>
    tool(() =>
      client
        ? api('PATCH', `/consultora/clients/${enc(client)}`, fields)
        : api('POST', '/consultora/clients', fields)
    )
)

server.registerTool(
  'save_project',
  {
    description:
      'Crea un proyecto (sin "project"; requiere "client") o edita uno ("project" = id o nombre). ' +
      'deliverablesMd es una lista markdown de casillas: "- [ ] Entregable". Marca hechos con "- [x]".',
    inputSchema: {
      project: z.string().optional(),
      client: z.string().optional(),
      name: z.string().optional(),
      status: z.enum(['activo', 'pausa', 'cerrado']).optional(),
      objectiveMd: z.string().optional(),
      deliverablesMd: z.string().optional(),
      notesMd: z.string().optional()
    }
  },
  ({ project, ...fields }) =>
    tool(() =>
      project
        ? api('PATCH', `/consultora/projects/${enc(project)}`, fields)
        : api('POST', '/consultora/projects', fields)
    )
)

server.registerTool(
  'save_prospect',
  {
    description:
      'Crea un prospecto (sin "prospect") o edita uno. Para cambiar de etapa usa move_prospect. ' +
      'valueUsd = valor estimado en USD.',
    inputSchema: {
      prospect: z.string().optional(),
      company: z.string().optional(),
      contactMd: z.string().optional(),
      valueUsd: z.number().min(0).optional(),
      source: z.string().optional(),
      notesMd: z.string().optional(),
      nextStep: z.string().optional(),
      nextStepDate: day.optional(),
      stage: z.string().optional().describe('Solo al crear: etapa inicial')
    }
  },
  ({ prospect, ...fields }) =>
    tool(() =>
      prospect
        ? api('PATCH', `/consultora/prospects/${enc(prospect)}`, fields)
        : api('POST', '/consultora/prospects', fields)
    )
)

server.registerTool(
  'move_prospect',
  {
    description:
      'Mueve un prospecto a otra etapa. Una etapa de tipo ganado lo convierte en cliente (crea cliente y carpeta).',
    inputSchema: {
      prospect: ref('del prospecto'),
      stage: ref('de la etapa'),
      index: z.number().int().min(0).optional().describe('Posición dentro de la etapa (0 = arriba)')
    }
  },
  ({ prospect, stage, index }) =>
    tool(() => api('POST', `/consultora/prospects/${enc(prospect)}/move`, { stage, index }))
)

server.registerTool(
  'create_meeting',
  {
    description:
      'Registra una reunión sin grabación (p. ej. con notas que te dicta el dueño). ' +
      'Puedes dar el resumen, decisiones y action items ya escritos, o solo rawNotesMd y luego process=true para que se resuman solos.',
    inputSchema: {
      title: z.string(),
      date: z.string().optional().describe('ISO; por defecto ahora'),
      client: z.string().optional(),
      project: z.string().optional(),
      prospect: z.string().optional(),
      participants: z.array(z.string()).optional(),
      summaryMd: z.string().optional(),
      decisionsMd: z.string().optional(),
      actionItems: z
        .array(
          z.object({
            text: z.string(),
            owner: z.string().nullable().optional(),
            due: z.string().nullable().optional()
          })
        )
        .optional(),
      rawNotesMd: z.string().optional(),
      process: z.boolean().optional()
    }
  },
  ({ process, ...fields }) =>
    tool(async () => {
      const meeting = (await api('POST', '/consultora/meetings', fields)) as { id: string }
      return process ? api('POST', `/consultora/meetings/${enc(meeting.id)}/process`) : meeting
    })
)

server.registerTool(
  'update_meeting',
  {
    description:
      'Edita una reunión: título, asociación (client/project/prospect; "" la quita), participantes, resumen, decisiones, ' +
      'action items (lista completa) o notas.',
    inputSchema: {
      id: z.string(),
      title: z.string().optional(),
      client: z.string().optional(),
      project: z.string().optional(),
      prospect: z.string().optional(),
      participants: z.array(z.string()).optional(),
      summaryMd: z.string().optional(),
      decisionsMd: z.string().optional(),
      actionItems: z
        .array(
          z.object({
            text: z.string(),
            owner: z.string().nullable().optional(),
            due: z.string().nullable().optional(),
            done: z.boolean().optional()
          })
        )
        .optional(),
      rawNotesMd: z.string().optional()
    }
  },
  ({ id, ...fields }) => tool(() => api('PATCH', `/consultora/meetings/${enc(id)}`, fields))
)

server.registerTool(
  'update_action_item',
  {
    description:
      'Marca un action item como hecho (done: true) o lo edita. index = posición en la reunión (de list_action_items).',
    inputSchema: {
      meeting_id: z.string(),
      index: z.number().int().min(0),
      done: z.boolean().optional(),
      text: z.string().optional(),
      owner: z.string().nullable().optional(),
      due: z.string().nullable().optional()
    }
  },
  ({ meeting_id, index, ...fields }) =>
    tool(() =>
      api('PATCH', `/consultora/meetings/${enc(meeting_id)}/action-items/${index}`, fields)
    )
)

server.registerTool(
  'append_note',
  {
    description:
      'Añade una nota fechada al final de las notas de un cliente, proyecto, prospecto o reunión. ' +
      'La forma más rápida de guardar contexto que el dueño te cuenta ("anota que Acme aprobó el presupuesto").',
    inputSchema: {
      entity: z.enum(['client', 'project', 'prospect', 'meeting']),
      ref: z.string().describe('id o nombre (reunión: id)'),
      text: z.string().min(1)
    }
  },
  (args) => tool(() => api('POST', '/consultora/notes/append', args))
)

// ---- Contactos ----

const contactStatus = z
  .enum(['none', 'subscribed', 'unsubscribed', 'bounced', 'complained'])
  .describe('none = contacto de trabajo (sin marketing); subscribed = recibe emails')

server.registerTool(
  'list_contacts',
  {
    description:
      'Contactos (personas de clientes y prospectos, y leads de email) con empresa y tags, paginados. ' +
      'Filtra por cliente, prospecto, texto (nombre, rol, email, empresa), tag (slug), estado de suscripción o fuente.',
    inputSchema: {
      client: z.string().optional(),
      prospect: z.string().optional(),
      query: z.string().optional(),
      tag: z.string().optional(),
      status: contactStatus.optional(),
      source: z.string().optional().describe('Slug de la fuente (o "manual")'),
      page: z.number().int().min(1).optional(),
      page_size: z.number().int().min(1).max(200).optional().describe('50 por defecto')
    }
  },
  ({ client, prospect, query: q, tag, status, source, page, page_size }) =>
    tool(() =>
      api(
        'GET',
        `/consultora/contacts${query({ client, prospect, q, tag, status, source, page, pageSize: page_size })}`
      )
    )
)

server.registerTool(
  'tag_contact',
  {
    description:
      'Añade y/o quita tags de un contacto (nombre o slug; los nuevos se crean). Los tags añadidos disparan ' +
      'sus reglas y, si el contacto está suscrito, el evento tag.<slug> en Resend (que puede iniciar una secuencia).',
    inputSchema: {
      id: z.string(),
      add: z.array(z.string()).optional(),
      remove: z.array(z.string()).optional()
    }
  },
  ({ id, add, remove }) =>
    tool(() => api('POST', `/consultora/contacts/${enc(id)}/tags`, { add, remove }))
)

server.registerTool(
  'set_contact_subscription',
  {
    description:
      'Suscribe (subscribed: true) o da de baja (false) a un contacto de los emails de marketing. ' +
      'Suscribir solo con su consentimiento explícito (opt-in) y exige email. Rebotes y quejas no se reactivan.',
    inputSchema: { id: z.string(), subscribed: z.boolean() }
  },
  ({ id, subscribed }) =>
    tool(() =>
      api('POST', `/consultora/contacts/${enc(id)}/${subscribed ? 'subscribe' : 'unsubscribe'}`)
    )
)

server.registerTool(
  'promote_contact',
  {
    description:
      'Pasa un contacto al pipeline de ventas: crea un prospecto con sus datos (empresa = fields.company, nombre o email) ' +
      'y lo enlaza. Falla si ya tiene prospecto.',
    inputSchema: {
      id: z.string(),
      stage: z.string().optional().describe('Etapa (id o nombre); vacío = primera abierta')
    }
  },
  ({ id, stage }) => tool(() => api('POST', `/consultora/contacts/${enc(id)}/promote`, { stage }))
)

server.registerTool(
  'list_sources',
  {
    description:
      'Fuentes de leads (webhooks de entrada): slug, nombre, tags por defecto, leads recibidos y último recibido. ' +
      'Cada lead que entra por una fuente lleva el tag origen-<slug>.',
    inputSchema: {}
  },
  () => tool(() => api('GET', '/marketing/sources'))
)

server.registerTool(
  'list_rules',
  {
    description:
      'Reglas por tag («cuando entra el tag X → acciones»), en orden. Se aplican al recibir un lead por webhook ' +
      'y al añadir tags con tag_contact. Las etapas de promote se guardan por id.',
    inputSchema: {}
  },
  () => tool(() => api('GET', '/marketing/rules'))
)

const ruleAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_tag'), tag: z.string().min(1) }),
  z.object({ type: z.literal('remove_tag'), tag: z.string().min(1) }),
  z.object({
    type: z.literal('fire_event'),
    event: z
      .string()
      .regex(/^[a-zA-Z0-9._-]{1,100}$/)
      .describe('Evento de Resend que puede disparar una secuencia')
  }),
  z.object({
    type: z.literal('promote'),
    stage: z.string().describe('Etapa del pipeline (id o nombre); "" = primera abierta')
  })
])

server.registerTool(
  'save_rule',
  {
    description:
      'Crea una regla (sin "id") o edita una. trigger_tag = tag que la dispara al entrar. Acciones: add_tag, remove_tag, ' +
      'fire_event (evento de Resend), promote (pasa a pipeline). Las reglas se encadenan (máx. 5 niveles). ' +
      'Ej.: cuando entra "webinar" → add_tag "nurture" + fire_event "webinar.followup".',
    inputSchema: {
      id: z.string().optional(),
      name: z.string().optional(),
      trigger_tag: z.string().optional(),
      actions: z.array(ruleAction).min(1).max(10).optional(),
      active: z.boolean().optional()
    }
  },
  ({ id, trigger_tag, ...fields }) =>
    tool(() => {
      const body = { ...fields, triggerTag: trigger_tag }
      return id
        ? api('PATCH', `/marketing/rules/${enc(id)}`, body)
        : api('POST', '/marketing/rules', body)
    })
)

server.registerTool(
  'delete_rule',
  {
    description: 'Borra una regla. Para pausarla sin perderla usa save_rule con active: false.',
    inputSchema: { id: z.string() }
  },
  ({ id }) => tool(() => api('DELETE', `/marketing/rules/${enc(id)}`))
)

// ---- Secuencias (Automations de Resend) ----

server.registerTool(
  'list_sequences',
  {
    description:
      'Secuencias de email (Automations de Resend): nombre, estado (enabled/disabled), evento que las dispara ' +
      '(p. ej. tag.webinar o lead.created), nº de emails y enlace al dashboard.',
    inputSchema: {}
  },
  () => tool(() => api('GET', '/marketing/sequences'))
)

server.registerTool(
  'save_sequence',
  {
    description:
      'Crea (sin "id") o reescribe una secuencia lineal en Resend: evento → [espera] → email → [espera] → email… ' +
      'Cada email se guarda como template con enlace de baja. Eventos útiles: "lead.created" (lead nuevo), ' +
      '"tag.<slug>" (entra en un tag) o el de una regla fire_event. Queda pausada salvo enabled: true. ' +
      'Resend no deja editar una secuencia activa: pausa con set_sequence_status antes de reescribirla. ' +
      'Solo para contactos suscritos (opt-in).',
    inputSchema: {
      id: z.string().optional(),
      name: z.string().min(1),
      event: z.string().regex(/^[a-zA-Z0-9._-]{1,100}$/),
      emails: z
        .array(
          z.object({
            wait: z
              .string()
              .optional()
              .describe('Espera antes de este email: "1 day", "3 hours", "30 minutes", "2 weeks"'),
            subject: z.string().min(1).max(200),
            html: z.string().min(1).describe('HTML del email')
          })
        )
        .min(1)
        .max(20),
      enabled: z.boolean().optional()
    }
  },
  (args) => tool(() => api('POST', '/marketing/sequences', args))
)

server.registerTool(
  'set_sequence_status',
  {
    description: 'Activa (enabled: true) o pausa (false) una secuencia de Resend.',
    inputSchema: { id: z.string(), enabled: z.boolean() }
  },
  ({ id, enabled }) =>
    tool(() => api('POST', `/marketing/sequences/${enc(id)}/status`, { enabled }))
)

// ---- Newsletter ----

server.registerTool(
  'get_newsletter_context',
  {
    description:
      'Antes de escribir el newsletter: si está en pausa, si ya se envió hoy, los últimos asuntos (para no repetir temas) ' +
      'y los tags con suscritos (la audiencia posible).',
    inputSchema: {}
  },
  () => tool(() => api('GET', '/marketing/newsletters/context'))
)

server.registerTool(
  'send_newsletter',
  {
    description:
      'Envía el newsletter de hoy a los suscritos de un tag (Broadcast de Resend). Máximo uno por día; ' +
      'falla si está en pausa, si el tag no tiene suscritos o si ya se envió hoy. Antes manda una copia al dueño. ' +
      'Se añade el enlace de baja si el HTML no lo trae ({{{RESEND_UNSUBSCRIBE_URL}}}). ' +
      'Escribe en el idioma de la audiencia, con un asunto claro y sin promesas falsas.',
    inputSchema: {
      tag: z.string().describe('Slug del tag (ver get_newsletter_context)'),
      subject: z.string().min(1).max(200),
      html: z.string().min(1).describe('HTML completo del email'),
      scheduled_at: z
        .string()
        .optional()
        .describe('Programar: ISO 8601 o "tomorrow at 9am". Vacío = ahora')
    }
  },
  ({ tag, subject, html, scheduled_at }) =>
    tool(() =>
      api('POST', '/marketing/newsletters', { tag, subject, html, scheduledAt: scheduled_at })
    )
)

server.registerTool(
  'list_newsletters',
  {
    description:
      'Historial de newsletters (día, tag, asunto, estado: sent, scheduled, sending, failed y error).',
    inputSchema: { limit: z.number().int().min(1).max(200).optional() }
  },
  ({ limit }) => tool(() => api('GET', `/marketing/newsletters${query({ limit })}`))
)

server.registerTool(
  'list_tags',
  {
    description:
      'Tags de contactos (slug, nombre) con cuántos contactos y suscritos tiene cada uno.',
    inputSchema: {}
  },
  () => tool(() => api('GET', '/marketing/tags'))
)

server.registerTool(
  'get_contact',
  {
    description:
      'Un contacto: datos, empresa, tags, estado de suscripción, fuente, campos, línea de tiempo y reuniones donde aparece.',
    inputSchema: { id: z.string() }
  },
  ({ id }) => tool(() => api('GET', `/consultora/contacts/${enc(id)}`))
)

server.registerTool(
  'save_contact',
  {
    description:
      'Crea un contacto (sin "id") o edita uno. Nombre o email obligatorio; el email es único. ' +
      'client / prospect = id o nombre de la empresa ("" quita la relación). ' +
      'Crear no lo suscribe a emails: usa set_contact_subscription. Para tags usa tag_contact.',
    inputSchema: {
      id: z.string().optional(),
      name: z.string().optional(),
      role: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      linkedin: z.string().optional(),
      notesMd: z.string().optional(),
      fields: z
        .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional()
        .describe('Campos libres (reemplaza todos)'),
      client: z.string().optional(),
      prospect: z.string().optional()
    }
  },
  ({ id, ...fields }) =>
    tool(() =>
      id
        ? api('PATCH', `/consultora/contacts/${enc(id)}`, fields)
        : api('POST', '/consultora/contacts', fields)
    )
)

// ---- Subir una grabación existente ----

server.registerTool(
  'import_recording',
  {
    description:
      'Transcribe y resume una reunión ya grabada (archivo en el Mac del dueño: mp4, mov, m4v, mkv, webm, mp3, m4a, wav). ' +
      'language = idioma hablado: "es" o "en". Se copia a la carpeta de documentos; el procesado sigue en segundo plano ' +
      '(consulta con get_meeting).',
    inputSchema: {
      path: z.string().describe('Ruta absoluta del archivo'),
      language: z.enum(['es', 'en']),
      title: z.string().optional(),
      participants: z.array(z.string()).optional(),
      clientId: z.string().optional(),
      projectId: z.string().optional(),
      prospectId: z.string().optional()
    }
  },
  (args) => tool(() => api('POST', '/consultora/meetings/import', args))
)

void server.connect(new StdioServerTransport())
