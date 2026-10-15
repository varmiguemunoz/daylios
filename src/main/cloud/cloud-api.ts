import { SYNC_PROTOCOL_VERSION } from '@shared/sync-protocol'

export class CloudApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: () => Promise<string | null>
  ) {}

  async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.token()
    if (!token) throw new Error('Inicia sesión de nuevo.')
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'x-daylios-protocol': String(SYNC_PROTOCOL_VERSION),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000)
      })
    } catch {
      throw new Error('No hay conexión con la nube de Alisuite.')
    }
    const text = await res.text()
    const data: unknown = text ? JSON.parse(text) : null
    if (!res.ok) {
      const message = (data as { message?: unknown } | null)?.message
      throw new Error(typeof message === 'string' ? message : `La nube respondió ${res.status}.`)
    }
    return data as T
  }
}
