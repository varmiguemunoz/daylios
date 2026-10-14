import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { api, tool, query, enc } from '../client'

export function register(server: McpServer): void {
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
                .describe(
                  'Espera antes de este email: "1 day", "3 hours", "30 minutes", "2 weeks"'
                ),
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
        'Tags con su uso. kind = "contact" (por defecto): slug, nombre, contactos, suscritos y audience ' +
        '(true = tiene Segment en Resend y puede recibir newsletters). kind = "task": tags de tareas con cuántas los usan.',
      inputSchema: { kind: z.enum(['contact', 'task']).optional() }
    },
    ({ kind }) => tool(() => api('GET', kind === 'task' ? '/task-tags' : '/marketing/tags'))
  )

  server.registerTool(
    'rename_tag',
    {
      description: 'Cambia el nombre visible de un tag de contactos. El slug no cambia.',
      inputSchema: { slug: z.string(), name: z.string().min(1).max(60) }
    },
    ({ slug, name }) => tool(() => api('PATCH', `/marketing/tags/${enc(slug)}`, { name }))
  )

  server.registerTool(
    'set_tag_audience',
    {
      description:
        'Marca (true) o desmarca (false) un tag de contactos como audiencia. Audiencia = tiene Segment en ' +
        'Resend (se crea y se sincronizan sus suscritos) y puede recibir newsletters. Desmarcar borra el Segment. ' +
        'El plan de Resend limita cuántos Segments hay.',
      inputSchema: { slug: z.string(), audience: z.boolean() }
    },
    ({ slug, audience }) => tool(() => api('PATCH', `/marketing/tags/${enc(slug)}`, { audience }))
  )

  server.registerTool(
    'delete_tag',
    {
      description:
        'Borra un tag de contactos: lo quita de todos los contactos y fuentes y borra su Segment. ' +
        'Sin confirm devuelve dónde se usa (no borra). Falla si lo usa una regla activa.',
      inputSchema: { slug: z.string(), confirm: z.literal(true).optional() }
    },
    ({ slug, confirm }) =>
      tool(() => api('DELETE', `/marketing/tags/${enc(slug)}${confirm ? '?confirm=1' : ''}`))
  )

  server.registerTool(
    'rename_task_tag',
    {
      description:
        'Renombra un tag de tareas en todas las tareas y subtareas. Si el nuevo ya existe, se fusionan.',
      inputSchema: { from: z.string(), to: z.string() }
    },
    ({ from, to }) => tool(() => api('PATCH', `/task-tags/${enc(from)}`, { name: to }))
  )

  server.registerTool(
    'delete_task_tag',
    {
      description: 'Quita un tag de todas las tareas y subtareas.',
      inputSchema: { tag: z.string(), confirm: z.literal(true) }
    },
    ({ tag }) => tool(() => api('DELETE', `/task-tags/${enc(tag)}`))
  )

  server.registerTool(
    'save_source',
    {
      description:
        'Crea (sin slug) o edita una fuente de leads (webhook de entrada). defaultTags = tags extra para cada lead. ' +
        'El secreto nunca se devuelve: se copia desde la app (Fuentes).',
      inputSchema: {
        slug: z.string().optional().describe('Para editar'),
        name: z.string().min(1).max(80).optional(),
        new_slug: z
          .string()
          .optional()
          .describe('Solo al crear: slug de la URL (por defecto, del nombre)'),
        defaultTags: z.array(z.string()).max(20).optional()
      }
    },
    ({ slug, new_slug, ...fields }) =>
      tool(() =>
        slug
          ? api('PATCH', `/marketing/sources/${enc(slug)}`, fields)
          : api('POST', '/marketing/sources', { ...fields, slug: new_slug })
      )
  )

  server.registerTool(
    'rotate_source_secret',
    {
      description:
        'Genera un secreto nuevo para una fuente: el anterior deja de funcionar. El nuevo se copia desde la app.',
      inputSchema: { slug: z.string() }
    },
    ({ slug }) => tool(() => api('POST', `/marketing/sources/${enc(slug)}/rotate`))
  )

  server.registerTool(
    'delete_source',
    {
      description:
        'Borra una fuente de leads (su URL deja de aceptar leads). Sin confirm no borra.',
      inputSchema: { slug: z.string(), confirm: z.literal(true).optional() }
    },
    ({ slug, confirm }) =>
      tool(() =>
        api(
          'DELETE',
          `/marketing/sources/${enc(slug)}${query({ confirm: confirm ? 1 : undefined })}`
        )
      )
  )

  server.registerTool(
    'get_sequence',
    {
      description: 'Una secuencia de Resend con sus pasos (esperas y emails).',
      inputSchema: { id: z.string() }
    },
    ({ id }) => tool(() => api('GET', `/marketing/sequences/${enc(id)}`))
  )

  server.registerTool(
    'get_newsletter',
    {
      description: 'Un newsletter enviado o programado, con su HTML.',
      inputSchema: { id: z.string() }
    },
    ({ id }) => tool(() => api('GET', `/marketing/newsletters/${enc(id)}`))
  )

  server.registerTool(
    'get_marketing_status',
    {
      description:
        'Estado de la sincronización: Resend y hub configurados, trabajos pendientes y con error, última descarga.',
      inputSchema: {}
    },
    () => tool(() => api('GET', '/marketing/status'))
  )

  server.registerTool(
    'sync_marketing_now',
    {
      description:
        'Descarga ya los leads del hub y vacía la cola hacia Resend. Devuelve el estado.',
      inputSchema: {}
    },
    () => tool(() => api('POST', '/marketing/sync'))
  )
}
