import { apolloError, messageFor } from './errors'

export type Query = Record<string, string | number | boolean | (string | number)[] | undefined>

export interface ApolloHttp {
  request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    init?: { query?: Query; body?: unknown }
  ): Promise<T>
}

export const APOLLO_BASE = 'https://api.apollo.io/api/v1'

export function toSearch(query: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) value.forEach((v) => params.append(`${key}[]`, String(v)))
    else params.append(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function createApolloHttp(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  minIntervalMs = 200
): ApolloHttp {
  let last = 0
  let chain: Promise<unknown> = Promise.resolve()

  const send = async <T>(
    method: string,
    path: string,
    init: { query?: Query; body?: unknown }
  ): Promise<T> => {
    const wait = last + minIntervalMs - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last = Date.now()
    let res: Response
    try {
      res = await fetchImpl(`${APOLLO_BASE}${path}${toSearch(init.query)}`, {
        method,
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(20_000)
      })
    } catch (error) {
      throw apolloError(
        `No se pudo conectar con Apollo: ${error instanceof Error ? error.message : String(error)}`,
        'network',
        null
      )
    }
    const text = await res.text()
    if (!res.ok)
      throw apolloError(messageFor(res.status, text.slice(0, 200)), 'http_error', res.status)
    return (text ? JSON.parse(text) : {}) as T
  }

  return {
    request(method, path, init = {}) {
      const result = chain.then(
        () => send(method, path, init),
        () => send(method, path, init)
      )
      chain = result.catch(() => undefined)
      return result as never
    }
  }
}
