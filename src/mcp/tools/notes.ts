import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { api, tool, query } from '../client'

/** Herramientas MCP: notes. */
export function register(server: McpServer): void {
  // ---- Notas ----
  server.registerTool(
    'list_notes',
    {
      description:
        'Notas rápidas (carpeta «Notas rápidas» del workspace) agrupadas por día de creación, paginadas por días. ' +
        'Para notas de otras carpetas usa workspace_list y workspace_search. ' +
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
      description:
        'Una nota completa por id, con sus relaciones: `related` (notas relacionadas) y `clients` (clientes).',
      inputSchema: { id: z.string() }
    },
    ({ id }) => tool(() => api('GET', `/notes/${encodeURIComponent(id)}/view`))
  )

  server.registerTool(
    'create_note',
    {
      description:
        'Crea una nota en markdown. La primera línea es el título (p. ej. "# Reunión"). ' +
        'Puede nacer relacionada con otras notas (related_notes, ids) y con clientes (clients, ids).',
      inputSchema: {
        body: z.string().min(1).max(100000),
        related_notes: z.array(z.string()).optional(),
        clients: z.array(z.string()).optional().describe('ids de clientes')
      }
    },
    (args) => tool(() => api('POST', '/notes', args))
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
      description:
        'Manda una nota a la Papelera de macOS y quita sus relaciones (las otras notas no se tocan).',
      inputSchema: { id: z.string() }
    },
    ({ id }) => tool(() => api('DELETE', `/notes/${encodeURIComponent(id)}`))
  )

  server.registerTool(
    'search_notes',
    {
      description:
        'Busca notas por título y texto (sin distinguir acentos). Devuelve id, título, extracto y fecha.',
      inputSchema: { query: z.string(), limit: z.number().int().min(1).max(50).optional() }
    },
    ({ query: q, limit }) => tool(() => api('GET', `/notes/search${query({ q, limit })}`))
  )

  const link = (id: string, target: { type: 'note' | 'client'; id: string }): Promise<unknown> =>
    api('POST', `/notes/${encodeURIComponent(id)}/links`, target)
  const unlink = (id: string, type: 'note' | 'client', target: string): Promise<unknown> =>
    api('DELETE', `/notes/${encodeURIComponent(id)}/links/${type}/${encodeURIComponent(target)}`)

  server.registerTool(
    'link_notes',
    {
      description: 'Relaciona dos notas (bidireccional: cada una muestra a la otra en su índice).',
      inputSchema: { id: z.string(), other: z.string().describe('id de la otra nota') }
    },
    ({ id, other }) => tool(() => link(id, { type: 'note', id: other }))
  )

  server.registerTool(
    'unlink_notes',
    {
      description: 'Quita la relación entre dos notas.',
      inputSchema: { id: z.string(), other: z.string() }
    },
    ({ id, other }) => tool(() => unlink(id, 'note', other))
  )

  server.registerTool(
    'link_note_client',
    {
      description:
        'Relaciona una nota con un cliente (aparece en la ficha del cliente y en get_client.notes).',
      inputSchema: { id: z.string(), client: z.string().describe('id del cliente') }
    },
    ({ id, client }) => tool(() => link(id, { type: 'client', id: client }))
  )

  server.registerTool(
    'unlink_note_client',
    {
      description: 'Quita la relación entre una nota y un cliente.',
      inputSchema: { id: z.string(), client: z.string() }
    },
    ({ id, client }) => tool(() => unlink(id, 'client', client))
  )
}
