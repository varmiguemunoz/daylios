import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join, posix, win32 } from 'path'
import { z } from 'zod'
import { APP_ID, APP_NAME, dataDirFor } from '@shared/app'

const CONNECTION_PATH =
  process.env.DAYLIOS_CONNECTION ??
  join(dataDirFor(process.platform, homedir(), process.env), 'connection.json')

const NOT_RUNNING = `${APP_NAME} no está abierto y no pude abrirlo. Ábrelo y vuelve a intentarlo.`
const SLOW = `${APP_NAME} tardó demasiado en responder. Vuelve a intentarlo en unos segundos.`
const REQUEST_MS = 30_000
const LAUNCH_WAIT_MS = 20_000

interface Connection {
  port: number
  token: string
}

class Unreachable extends Error {}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

function readConnection(): Connection | null {
  try {
    const value = JSON.parse(readFileSync(CONNECTION_PATH, 'utf8')) as Connection
    return typeof value.port === 'number' && typeof value.token === 'string' ? value : null
  } catch {
    return null
  }
}

async function healthy(connection: Connection): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${connection.port}/health`, {
      signal: AbortSignal.timeout(2_000)
    })
    return res.ok
  } catch {
    return false
  }
}

export function launchCommand(
  platform: NodeJS.Platform,
  execPath: string
): { command: string; args: string[] } | null {
  const binary = (platform === 'win32' ? win32 : posix).basename(execPath).toLowerCase()
  if (!binary.startsWith(APP_NAME.toLowerCase())) return null
  if (platform === 'darwin') return { command: 'open', args: ['-b', APP_ID] }
  return { command: execPath, args: [] }
}

function launchApp(): boolean {
  const launch = launchCommand(process.platform, process.execPath)
  if (!launch) return false
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  try {
    spawn(launch.command, launch.args, { detached: true, stdio: 'ignore', env }).unref()
    return true
  } catch {
    return false
  }
}

async function waitForApp(): Promise<Connection | null> {
  const until = Date.now() + LAUNCH_WAIT_MS
  while (Date.now() < until) {
    const connection = readConnection()
    if (connection && (await healthy(connection))) return connection
    await sleep(500)
  }
  return null
}

async function send(
  connection: Connection,
  method: string,
  path: string,
  body?: object
): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(`http://127.0.0.1:${connection.port}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${connection.token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_MS)
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') throw new Error(SLOW)
    throw new Unreachable()
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)
  return data
}

export async function api(method: string, path: string, body?: object): Promise<unknown> {
  const current = readConnection()
  if (current) {
    try {
      return await send(current, method, path, body)
    } catch (error) {
      if (!(error instanceof Unreachable)) throw error
    }
  }
  const fresh =
    (current && (await healthy(current)) ? current : null) ??
    (launchApp() ? await waitForApp() : null)
  if (!fresh) throw new Error(NOT_RUNNING)
  try {
    return await send(fresh, method, path, body)
  } catch (error) {
    if (error instanceof Unreachable) throw new Error(NOT_RUNNING)
    throw error
  }
}

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
