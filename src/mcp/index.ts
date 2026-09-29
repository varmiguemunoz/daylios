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

const query = (params: Record<string, string | number | undefined>): string => {
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
    description: 'Crea una tarea. Sin fecha = hoy. Falla si el día ya tiene 8 tareas.',
    inputSchema: { title: z.string().min(1).max(200), date: day.optional() }
  },
  ({ title, date }) => tool(() => api('POST', '/tasks', { title, date }))
)

server.registerTool(
  'update_task',
  {
    description:
      'Edita el título y/o marca una tarea como hecha (done: true) o pendiente (done: false).',
    inputSchema: {
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      done: z.boolean().optional()
    }
  },
  ({ id, title, done }) =>
    tool(() => api('PATCH', `/tasks/${encodeURIComponent(id)}`, { title, done }))
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

void server.connect(new StdioServerTransport())
