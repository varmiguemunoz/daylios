/** Cliente HTTP de la API local de DayliOS y ayudantes compartidos por las herramientas MCP. */
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { z } from 'zod'

const CONNECTION_PATH =
  process.env.DAYLIOS_CONNECTION ??
  join(homedir(), 'Library', 'Application Support', 'daily-os', 'connection.json')

const NOT_RUNNING = 'DayliOS no está abierto. Ábrelo desde el menubar y vuelve a intentarlo.'

/** Llama a la API local. Lee la conexión en cada llamada: la app puede haber reiniciado. */
export async function api(method: string, path: string, body?: object): Promise<unknown> {
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
export async function tool(run: () => Promise<unknown>): Promise<{
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

export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Fecha local YYYY-MM-DD')

export const query = (params: Record<string, string | number | boolean | undefined>): string => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const ref = (what: string): z.ZodString => z.string().min(1).describe(`id o nombre ${what}`)
export const enc = encodeURIComponent
