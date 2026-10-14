import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { api, enc, query, tool } from '../client'

const item = z.string().min(1).describe('id o ruta en el workspace («Ventas/Embudo.canvas»)')
const folder = z.string().optional().describe('id o ruta de la carpeta; vacío = raíz del workspace')
const color = z
  .string()
  .describe('"1" coral, "2" albaricoque, "3" mantequilla, "4" menta, "5" leche, "6" rosa, o #hex')
const pos = {
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional()
}

const boardOp = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_node'),
    kind: z.enum(['sticky', 'text', 'shape', 'file', 'link', 'group']),
    id: z.string().optional().describe('id propio para conectarlo en la misma llamada'),
    text: z.string().optional().describe('markdown (sticky, text, shape)'),
    shape: z.enum(['rect', 'ellipse', 'diamond']).optional(),
    file: z.string().optional().describe('ruta de una imagen o nota del workspace (kind file)'),
    url: z.string().url().optional().describe('kind link'),
    label: z.string().optional().describe('título del grupo'),
    color: color.optional(),
    ...pos
  }),
  z.object({
    op: z.literal('update_node'),
    id: z.string(),
    text: z.string().optional(),
    label: z.string().optional(),
    color: color.nullable().optional().describe('null quita el color'),
    shape: z.enum(['rect', 'ellipse', 'diamond']).optional(),
    ...pos
  }),
  z.object({ op: z.literal('remove_node'), id: z.string() }),
  z.object({
    op: z.literal('add_edge'),
    from: z.string(),
    to: z.string(),
    id: z.string().optional(),
    label: z.string().optional(),
    arrow: z.enum(['none', 'end', 'both']).optional().describe('por defecto end')
  }),
  z.object({ op: z.literal('remove_edge'), id: z.string() })
])

export function register(server: McpServer): void {
  server.registerTool(
    'workspace_tree',
    {
      description:
        'Árbol de carpetas del workspace con cuántos archivos tiene cada una. El workspace es una carpeta real ' +
        '(estilo Obsidian): notas .md, boards .canvas (JSON Canvas), imágenes y archivos.',
      inputSchema: {}
    },
    () => tool(() => api('GET', '/workspace/tree'))
  )

  server.registerTool(
    'workspace_list',
    {
      description:
        'Contenido de una carpeta: subcarpetas, notas, boards, imágenes y archivos, con ruta e id.',
      inputSchema: { folder }
    },
    ({ folder: f }) => tool(() => api('GET', `/workspace/list${query({ folder: f })}`))
  )

  server.registerTool(
    'workspace_search',
    {
      description:
        'Busca en el workspace por nombre de archivo y por texto de las notas (sin distinguir acentos).',
      inputSchema: { query: z.string().min(2) }
    },
    ({ query: q }) => tool(() => api('GET', `/workspace/search${query({ q })}`))
  )

  server.registerTool(
    'workspace_read',
    {
      description:
        'Lee un elemento: el markdown de una nota o el JSON de un board (para boards, mejor board_read). ' +
        'De imágenes y otros archivos devuelve solo sus datos.',
      inputSchema: { item }
    },
    ({ item: ref }) => tool(() => api('GET', `/workspace/items/${enc(ref)}`))
  )

  server.registerTool(
    'workspace_write_note',
    {
      description:
        'Crea una nota en una carpeta (sin note) o reescribe una existente (con note). Markdown; la primera ' +
        'línea es el título. Para notas rápidas del día usa create_note.',
      inputSchema: {
        note: item.optional().describe('nota existente a reescribir'),
        folder,
        name: z.string().max(120).optional().describe('nombre del archivo al crear (sin .md)'),
        body: z.string().max(100000)
      }
    },
    ({ note, folder: f, name, body }) =>
      tool(() =>
        note
          ? api('PUT', `/workspace/notes/${enc(note)}`, { body })
          : api('POST', '/workspace/notes', { folder: f, name: name ?? 'Sin título', body })
      )
  )

  server.registerTool(
    'workspace_create_folder',
    {
      description: 'Crea una carpeta (o subcarpeta).',
      inputSchema: { parent: folder, name: z.string().min(1).max(120) }
    },
    (args) => tool(() => api('POST', '/workspace/folders', args))
  )

  server.registerTool(
    'workspace_move',
    {
      description:
        'Renombra (name) o mueve a otra carpeta (folder; "" = raíz) un elemento. Los enlaces de notas y boards ' +
        'que apuntan a él se actualizan solos.',
      inputSchema: { item, name: z.string().max(120).optional(), folder }
    },
    ({ item: ref, name, folder: f }) =>
      tool(() =>
        api('PATCH', `/workspace/items/${enc(ref)}`, {
          name,
          ...(f !== undefined ? { folder: f } : {})
        })
      )
  )

  server.registerTool(
    'workspace_delete',
    {
      description:
        'Manda un elemento (o una carpeta con todo) a la Papelera de macOS. Sin confirm devuelve qué se pierde ' +
        'y qué enlaces quedan rotos, y no borra.',
      inputSchema: { item, confirm: z.literal(true).optional() }
    },
    ({ item: ref, confirm }) =>
      tool(() =>
        api('DELETE', `/workspace/items/${enc(ref)}${query({ confirm: confirm ? 1 : undefined })}`)
      )
  )

  server.registerTool(
    'board_read',
    {
      description:
        'Un board en forma compacta: nodos (id, kind: sticky, text, shape:rect|ellipse|diamond, file, link, group; ' +
        'texto, posición y tamaño) y conexiones (from, to, label, arrow).',
      inputSchema: { board: item }
    },
    ({ board }) => tool(() => api('GET', `/workspace/boards/${enc(board)}`))
  )

  server.registerTool(
    'board_edit',
    {
      description:
        'Edita un board con operaciones en orden: add_node, update_node, remove_node, add_edge, remove_edge. ' +
        'Pon id propios en add_node para conectarlos en la misma llamada. Sin x/y, los nodos nuevos van a la ' +
        'derecha de lo que ya hay. Para crear un board vacío usa workspace_create_board.',
      inputSchema: { board: item, ops: z.array(boardOp).min(1).max(200) }
    },
    ({ board, ops }) => tool(() => api('POST', `/workspace/boards/${enc(board)}/ops`, { ops }))
  )

  server.registerTool(
    'workspace_create_board',
    {
      description: 'Crea un board vacío en una carpeta. Luego llénalo con board_edit.',
      inputSchema: { folder, name: z.string().max(120).optional() }
    },
    (args) => tool(() => api('POST', '/workspace/boards', args))
  )
}
