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

const layout = z
  .enum(['flow-down', 'flow-right', 'tree', 'grid'])
  .describe('acomodo automático de los nodos nuevos sin x/y')

export function diagramOps(
  nodes: {
    id: string
    text: string
    kind?: 'shape' | 'sticky' | 'text'
    shape?: string
    color?: string
  }[],
  edges: { from: string; to: string; label?: string; arrow?: 'none' | 'end' | 'both' }[]
): Record<string, unknown>[] {
  return [
    ...nodes.map((n) => ({
      op: 'add_node',
      id: n.id,
      kind: n.kind ?? 'shape',
      text: n.text,
      ...((n.kind ?? 'shape') === 'shape' ? { shape: n.shape ?? 'rect' } : {}),
      ...(n.color ? { color: n.color } : {})
    })),
    ...edges.map((e) => ({
      op: 'add_edge',
      from: e.from,
      to: e.to,
      ...(e.label ? { label: e.label } : {}),
      ...(e.arrow ? { arrow: e.arrow } : {})
    }))
  ]
}

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
        'Pon id propios en add_node para conectarlos en la misma llamada. Si alguna operación falla no se aplica ' +
        'ninguna y recibes todos los errores con su número. Con layout, los nodos nuevos sin x/y se acomodan solos ' +
        '(flow-down, flow-right, tree, grid) a la derecha de lo que ya hay; sin layout van en fila. ' +
        'Responde con los ids creados y los conteos; pide response: "full" solo si necesitas el board entero. ' +
        'Hasta 500 operaciones por llamada. Para diagramas de flujo completos usa board_diagram.',
      inputSchema: {
        board: item,
        ops: z.array(boardOp).min(1).max(500),
        layout: layout.optional(),
        response: z.enum(['compact', 'full']).optional()
      }
    },
    ({ board, ops, layout: l, response }) =>
      tool(() => api('POST', `/workspace/boards/${enc(board)}/ops`, { ops, layout: l, response }))
  )

  server.registerTool(
    'board_diagram',
    {
      description:
        'Dibuja un diagrama completo en un board en una sola llamada: nodos con id propio y conexiones entre ellos. ' +
        'Se acomoda solo (flow-down por defecto) y las flechas salen del lado correcto. Úsalo para diagramas de ' +
        'flujo, organigramas, mapas mentales o grafos. Shapes: rect para pasos, diamond para decisiones, ellipse ' +
        'para inicio y fin. Hasta 250 nodos y 250 conexiones; para más, divide en varias llamadas.',
      inputSchema: {
        board: item,
        layout: layout.optional(),
        nodes: z
          .array(
            z.object({
              id: z.string().min(1).max(60),
              text: z.string().max(2000),
              kind: z.enum(['shape', 'sticky', 'text']).optional().describe('por defecto shape'),
              shape: z.enum(['rect', 'ellipse', 'diamond']).optional(),
              color: color.optional()
            })
          )
          .min(1)
          .max(250),
        edges: z
          .array(
            z.object({
              from: z.string(),
              to: z.string(),
              label: z.string().max(200).optional(),
              arrow: z.enum(['none', 'end', 'both']).optional()
            })
          )
          .max(250)
          .optional()
      }
    },
    ({ board, layout: l, nodes, edges }) =>
      tool(() =>
        api('POST', `/workspace/boards/${enc(board)}/ops`, {
          layout: l ?? 'flow-down',
          ops: diagramOps(nodes, edges ?? [])
        })
      )
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
