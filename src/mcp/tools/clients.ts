import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { api, tool, day, query, ref, enc } from '../client'

/** Herramientas MCP: clients. */
export function register(server: McpServer): void {
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

  server.registerTool(
    'get_client_impact',
    {
      description:
        'Qué pasaría al borrar un cliente: proyectos que se borran; reuniones, contactos, prospectos y notas que se desvinculan; carpeta.',
      inputSchema: { client: ref('del cliente') }
    },
    ({ client }) => tool(() => api('GET', `/consultora/clients/${enc(client)}/impact`))
  )

  server.registerTool(
    'delete_client',
    {
      description:
        'Borra un cliente y sus proyectos; reuniones, contactos y prospectos quedan sin cliente y las notas pierden la relación. ' +
        'La carpeta se queda en el disco salvo trash_folder = true (va a la Papelera). Sin confirm devuelve el impacto y no borra.',
      inputSchema: {
        client: ref('del cliente'),
        confirm: z.literal(true).optional(),
        trash_folder: z.boolean().optional()
      }
    },
    ({ client, confirm, trash_folder }) =>
      tool(() =>
        api(
          'DELETE',
          `/consultora/clients/${enc(client)}${query({ confirm: confirm ? 1 : undefined, trashFolder: trash_folder ? 1 : undefined })}`
        )
      )
  )

  server.registerTool(
    'delete_project',
    {
      description:
        'Borra un proyecto. Sus reuniones y contactos se quedan en el cliente, sin proyecto. Sin confirm no borra.',
      inputSchema: { project: ref('del proyecto'), confirm: z.literal(true).optional() }
    },
    ({ project, confirm }) =>
      tool(() => api('DELETE', `/consultora/projects/${enc(project)}${query({ confirm: confirm ? 1 : undefined })}`))
  )

  server.registerTool(
    'write_document',
    {
      description:
        'Crea o reemplaza un documento de texto (.md, .txt, .csv, .json) en la carpeta del cliente. path = ruta relativa ' +
        '(p. ej. "Entregables/propuesta.md").',
      inputSchema: { client: ref('del cliente'), path: z.string(), content: z.string().max(1000000) }
    },
    ({ client, path, content }) =>
      tool(() => api('PUT', `/consultora/clients/${enc(client)}/documents`, { path, content }))
  )

  server.registerTool(
    'rename_document',
    {
      description: 'Renombra un documento en su misma subcarpeta. name = nombre nuevo con extensión.',
      inputSchema: { client: ref('del cliente'), path: z.string(), name: z.string().min(1) }
    },
    ({ client, path, name }) =>
      tool(() => api('PATCH', `/consultora/clients/${enc(client)}/documents`, { path, name }))
  )

  server.registerTool(
    'delete_document',
    {
      description: 'Manda un documento de la carpeta del cliente a la Papelera de macOS. Sin confirm no borra.',
      inputSchema: { client: ref('del cliente'), path: z.string(), confirm: z.literal(true).optional() }
    },
    ({ client, path, confirm }) =>
      tool(() =>
        api('DELETE', `/consultora/clients/${enc(client)}/documents${query({ path, confirm: confirm ? 1 : undefined })}`)
      )
  )
}
