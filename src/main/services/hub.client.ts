import type { HubConfig, HubHealth, HubItem } from '@shared/hub'
import { config } from '../config'

/** Cliente de la parte `/admin/*` del Worker `leads-hub`. Interfaz para poder usar un fake en tests. */
export interface HubClient {
  health(): Promise<HubHealth>
  inbox(limit?: number): Promise<HubItem[]>
  ack(ids: string[]): Promise<void>
  putConfig(hubConfig: HubConfig): Promise<HubConfig>
}

export type HubProvider = () => HubClient | null

export class HubError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'HubError'
  }
}

export function createHubClient(
  baseUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch
): HubClient {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let res: Response
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000)
      })
    } catch (e) {
      throw new HubError(
        `No se pudo conectar con el hub (${e instanceof Error ? e.message : String(e)}).`,
        0
      )
    }
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (!res.ok) {
      const reason =
        res.status === 401
          ? 'el token de administración no coincide'
          : (data?.error ?? `HTTP ${res.status}`)
      throw new HubError(`El hub respondió: ${reason}.`, res.status)
    }
    return data as T
  }

  return {
    health: () => call<HubHealth>('GET', '/admin/health'),
    inbox: async (limit = 100) =>
      (await call<{ items: HubItem[] }>('GET', `/admin/inbox?limit=${limit}`)).items,
    ack: async (ids) => {
      await call('POST', '/admin/ack', { ids })
    },
    putConfig: (hubConfig) => call<HubConfig>('PUT', '/admin/config', hubConfig)
  }
}

let cached: { key: string; client: HubClient } | null = null

/** Cliente con la URL y el token de Ajustes (null si falta alguno). */
export const hubFromConfig: HubProvider = () => {
  const url = config.hubUrl()
  const token = config.hubToken()
  if (!url || !token) return null
  const key = `${url}\n${token}`
  if (cached?.key !== key) cached = { key, client: createHubClient(url, token) }
  return cached.client
}
