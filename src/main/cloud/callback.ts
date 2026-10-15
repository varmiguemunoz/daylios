import { createServer, type Server } from 'http'
import { ACCOUNT_PROTOCOL } from '@shared/account'

export const DEEP_LINK = `${ACCOUNT_PROTOCOL}://auth/callback`
export const LOOPBACK_PORT = 47615
export const LOOPBACK_URL = `http://127.0.0.1:${LOOPBACK_PORT}/auth/callback`

const DONE_PAGE = `<!doctype html><meta charset="utf-8"><title>Alisuite</title>
<body style="font:15px -apple-system,sans-serif;background:#1e1e1e;color:#dadada;display:grid;place-items:center;height:100vh;margin:0">
<p>Listo. Ya puedes volver a Alisuite.</p></body>`

interface Pending {
  resolve: (code: string) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
  server: Server | null
}

export class AuthCallback {
  private pending: Pending | null = null

  constructor(private readonly packaged: boolean) {}

  redirectUrl(): string {
    return this.packaged ? DEEP_LINK : LOOPBACK_URL
  }

  async wait(timeoutMs: number): Promise<string> {
    this.cancel()
    const server = this.packaged ? null : await this.listen()
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => this.finish(new Error('No llegó respuesta del navegador.')),
        timeoutMs
      )
      this.pending = { resolve, reject, timer, server }
    })
  }

  handleUrl(raw: string): boolean {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return false
    }
    const isCallback =
      `${url.protocol}//${url.host}${url.pathname}` === DEEP_LINK ||
      (url.protocol === 'http:' && url.pathname === '/auth/callback')
    if (!isCallback || !this.pending) return isCallback
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error_description') ?? url.searchParams.get('error')
    if (code) this.finish(null, code)
    else this.finish(new Error(error ?? 'El navegador no devolvió un código.'))
    return true
  }

  cancel(): void {
    this.finish(new Error('Inicio de sesión cancelado.'))
  }

  private finish(error: Error | null, code?: string): void {
    const p = this.pending
    if (!p) return
    this.pending = null
    clearTimeout(p.timer)
    p.server?.close()
    if (error) p.reject(error)
    else p.resolve(code as string)
  }

  private listen(): Promise<Server> {
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        const ok = this.handleUrl(`http://127.0.0.1:${LOOPBACK_PORT}${req.url ?? ''}`)
        res.writeHead(ok ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(ok ? DONE_PAGE : '')
      })
      server.once('error', () =>
        reject(
          new Error(`El puerto ${LOOPBACK_PORT} está ocupado. Cierra lo que lo use y reintenta.`)
        )
      )
      server.listen(LOOPBACK_PORT, '127.0.0.1', () => resolve(server))
    })
  }
}
