import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { api, tool, query, enc } from '../client'

/** Herramientas MCP: contacts. */
export function register(server: McpServer): void {
  // ---- Contactos ----
  const contactStatus = z
    .enum(['none', 'subscribed', 'unsubscribed', 'bounced', 'complained'])
    .describe('none = contacto de trabajo (sin marketing); subscribed = recibe emails')

  server.registerTool(
    'list_contacts',
    {
      description:
        'Contactos (personas de clientes y prospectos, y leads de email) con empresa y tags, paginados. ' +
        'Filtra por cliente, prospecto, texto (nombre, rol, email, teléfono, empresa), tags (slugs: debe tenerlos todos), ' +
        'in_pipeline (true = en un prospecto, false = en ninguno), estado de suscripción o fuente.',
      inputSchema: {
        client: z.string().optional(),
        prospect: z.string().optional(),
        query: z.string().optional(),
        tag: z.string().optional(),
        tags: z.array(z.string()).optional(),
        in_pipeline: z.boolean().optional(),
        status: contactStatus.optional(),
        source: z.string().optional().describe('Slug de la fuente (o "manual")'),
        page: z.number().int().min(1).optional(),
        page_size: z.number().int().min(1).max(200).optional().describe('50 por defecto')
      }
    },
    ({ client, prospect, query: q, tag, tags, in_pipeline, status, source, page, page_size }) =>
      tool(() =>
        api(
          'GET',
          `/consultora/contacts${query({
            client,
            prospect,
            q,
            tag,
            tags: tags?.length ? tags.join(',') : undefined,
            inPipeline: in_pipeline === undefined ? undefined : in_pipeline ? 1 : 0,
            status,
            source,
            page,
            pageSize: page_size
          })}`
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
        'client / prospect = id o nombre ("" quita la relación); project = proyecto de su cliente ("" quita). ' +
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
        project: z.string().optional(),
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

  server.registerTool(
    'convert_contact',
    {
      description:
        'Convierte un contacto en prospecto: crea el prospecto en el pipeline y etapa elegidos (sin ellos: el primero y ' +
        'su primera etapa abierta) y lo enlaza. company = nombre del prospecto (por defecto su cliente, fields.company o el ' +
        'contacto). Falla si ya tiene prospecto.',
      inputSchema: {
        id: z.string(),
        pipeline: z.string().optional(),
        stage: z.string().optional(),
        company: z.string().optional(),
        value_usd: z.number().min(0).optional()
      }
    },
    ({ id, value_usd, ...rest }) =>
      tool(() => api('POST', `/consultora/contacts/${enc(id)}/convert`, { ...rest, valueUsd: value_usd }))
  )

  server.registerTool(
    'detach_contact_prospect',
    {
      description: 'Quita el vínculo de un contacto con su prospecto (el prospecto no se borra).',
      inputSchema: { id: z.string() }
    },
    ({ id }) => tool(() => api('POST', `/consultora/contacts/${enc(id)}/detach-prospect`))
  )

  server.registerTool(
    'delete_contact',
    {
      description:
        'Borra un contacto con sus tags y su línea de tiempo (si recibía emails, se da de baja en Resend). ' +
        'Sin confirm devuelve el contacto y no borra.',
      inputSchema: { id: z.string(), confirm: z.literal(true).optional() }
    },
    ({ id, confirm }) =>
      tool(() => api('DELETE', `/consultora/contacts/${enc(id)}${query({ confirm: confirm ? 1 : undefined })}`))
  )
}
