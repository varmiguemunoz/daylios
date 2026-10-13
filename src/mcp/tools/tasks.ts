import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { api, tool, day, query } from '../client'

/** Herramientas MCP: tasks. */
export function register(server: McpServer): void {
  server.registerTool(
    'get_day',
    {
      description:
        'Tareas de un día y su resumen: total, hechas, pendientes, huecos libres y techo (8). Sin fecha = hoy. ' +
          'Cada tarea trae `subtasks: { total, done }` si tiene subtareas (no cuentan para el techo; detalle con get_task).',
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
        'Con `parent` (id de una tarea) crea una SUBTAREA: vive en el día de la madre, no cuenta para el techo, ' +
        'sin límite; una subtarea no puede tener subtareas. ' +
        'El título admite markdown en línea; la descripción, markdown completo. ' +
        'Tags y esfuerzo: en el título ("Propuesta Acme #ventas !alto") o con tags / effort.',
      inputSchema: {
        title: z.string().min(1).max(200),
        parent: z.string().optional().describe('id de la tarea madre para crear una subtarea'),
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
      description: 'Elimina una tarea de forma permanente (si es madre, también sus subtareas).',
      inputSchema: { id: z.string() }
    },
    ({ id }) => tool(() => api('DELETE', `/tasks/${encodeURIComponent(id)}`))
  )

  server.registerTool(
    'move_task',
    {
      description:
        'Mueve una tarea a otro día (queda al final y recuerda su día de origen). Sus subtareas van con ella. ' +
        'Una subtarea no se mueve sola.',
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

  server.registerTool(
    'get_task',
    {
      description:
        'Detalle de una tarea: la tarea, su madre (si es subtarea) y sus subtareas en orden (si es madre).',
      inputSchema: { id: z.string() }
    },
    ({ id }) => tool(() => api('GET', `/tasks/${encodeURIComponent(id)}`))
  )

  server.registerTool(
    'reorder_tasks',
    {
      description: 'Nuevo orden de las tareas de un día: todos los ids de ese día en el orden deseado.',
      inputSchema: { date: day.optional(), ids: z.array(z.string()).min(1) }
    },
    (args) => tool(() => api('POST', '/reorder', args))
  )

  server.registerTool(
    'reorder_subtasks',
    {
      description: 'Nuevo orden de las subtareas de una tarea: todos sus ids en el orden deseado.',
      inputSchema: { parent: z.string(), ids: z.array(z.string()).min(1) }
    },
    ({ parent, ids }) =>
      tool(() => api('POST', `/tasks/${encodeURIComponent(parent)}/subtasks/reorder`, { ids }))
  )

  server.registerTool(
    'complete_subtasks',
    {
      description: 'Marca como hechas todas las subtareas pendientes de una tarea.',
      inputSchema: { parent: z.string() }
    },
    ({ parent }) => tool(() => api('POST', `/tasks/${encodeURIComponent(parent)}/subtasks/complete`))
  )
}
