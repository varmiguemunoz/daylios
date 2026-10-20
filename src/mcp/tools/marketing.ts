import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { api, tool, query, enc } from '../client'

export function register(server: McpServer): void {
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

  // ---- Outreach en frío (proveedor del rol outreach, p. ej. Apollo) ----
  server.registerTool(
    'get_outreach_status',
    {
      description:
        'Estado del outreach en frío: proveedor asignado, si está configurado, tope diario, inscritos hoy, ' +
        'cuántos quedan hoy y la última consulta de respuestas.',
      inputSchema: {}
    },
    () => tool(() => api('GET', '/marketing/outreach/status'))
  )

  server.registerTool(
    'list_outreach_sequences',
    {
      description: 'Secuencias de outreach en frío del proveedor de outreach, con estado y enlace.',
      inputSchema: {}
    },
    () => tool(() => api('GET', '/marketing/outreach/sequences'))
  )

  server.registerTool(
    'save_outreach_sequence',
    {
      description:
        'Crea (sin "id") o edita una secuencia de outreach en frío. Al crear queda inactiva. Al editar, pasa los ' +
        'ids de cada paso de get_outreach_sequence; un paso sin id es nuevo y uno omitido se borra. ' +
        'El primer email necesita asunto; los siguientes necesitan espera y, sin asunto, responden en el mismo hilo. ' +
        'Si en Ajustes hay un pie legal, se añade a cada email; si está vacío, no. Máximo 10 emails, cortos.',
      inputSchema: {
        id: z.string().optional(),
        name: z.string().min(1).max(120),
        emails: z
          .array(
            z.object({
              wait: z
                .string()
                .optional()
                .describe('Espera antes de este email: "3 days", "1 week"'),
              subject: z.string().max(200),
              html: z.string().min(1).describe('HTML sencillo del email'),
              thread: z
                .enum(['new', 'reply'])
                .optional()
                .describe('reply responde en el mismo hilo'),
              id: z.string().optional().describe('id del paso al editar, de get_outreach_sequence'),
              touchId: z.string().optional(),
              templateId: z.string().optional()
            })
          )
          .min(1)
          .max(10)
      }
    },
    (args) => tool(() => api('POST', '/marketing/outreach/sequences', args))
  )

  server.registerTool(
    'get_outreach_sequence',
    {
      description:
        'Una secuencia de outreach con su contenido: cada paso con espera, asunto, HTML, modo de hilo e ids. ' +
        'Para editar sin perder el avance de los inscritos, pasa esos ids a save_outreach_sequence.',
      inputSchema: { id: z.string() }
    },
    ({ id }) => tool(() => api('GET', `/marketing/outreach/sequences/${enc(id)}`))
  )

  server.registerTool(
    'archive_outreach_sequence',
    {
      description:
        'Elimina una secuencia de outreach archivándola en el proveedor: se desactiva y termina a todos sus ' +
        'inscritos. Pide confirmación explícita a la persona y pasa confirm: true solo si la dio.',
      inputSchema: { id: z.string(), confirm: z.boolean().optional() }
    },
    ({ id, confirm }) =>
      tool(() => api('POST', `/marketing/outreach/sequences/${enc(id)}/archive`, { confirm }))
  )

  server.registerTool(
    'set_outreach_sequence_status',
    {
      description:
        'Activa o pausa una secuencia de outreach. Activar envía correos reales desde los buzones conectados: ' +
        'pide confirmación explícita a la persona y pasa confirm: true solo si la dio.',
      inputSchema: { id: z.string(), enabled: z.boolean(), confirm: z.boolean().optional() }
    },
    ({ id, enabled, confirm }) =>
      tool(() =>
        api('POST', `/marketing/outreach/sequences/${enc(id)}/status`, { enabled, confirm })
      )
  )

  server.registerTool(
    'enroll_outreach',
    {
      description:
        'Inscribe contactos de Alisuite en una secuencia de outreach. Respeta el tope diario: lo que no cabe ' +
        'vuelve en "deferred" para inscribirlo otro día. Descarta a quien se dio de baja, rebotó o se quejó.',
      inputSchema: {
        sequenceId: z.string(),
        contactIds: z.array(z.string()).min(1).max(500),
        labels: z.array(z.string()).optional()
      }
    },
    (args) => tool(() => api('POST', '/marketing/outreach/enroll', args))
  )

  server.registerTool(
    'poll_outreach_replies',
    {
      description:
        'Trae ya las respuestas, rebotes y bajas del outreach. Las bajas suprimen al contacto en todo el email; ' +
        'las respuestas con interés crean una tarea.',
      inputSchema: {}
    },
    () => tool(() => api('POST', '/marketing/outreach/poll'))
  )

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
        'Estado del email: proveedor asignado a cada rol (transaccional, marketing, outreach) y si está configurado, ' +
        'hub, trabajos pendientes y con error, última descarga.',
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
