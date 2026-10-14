import { Controller, Get, Header, Inject, Param } from '@nestjs/common'
import { ACCOUNT_PROTOCOL } from '@shared/account'
import { INVITE_PATH } from '@shared/organizations'
import { escapeHtml } from '../mail/resend-mailer'

export const DOWNLOAD_URL = Symbol('DownloadUrl')

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/

@Controller(INVITE_PATH)
export class InvitePageController {
  constructor(@Inject(DOWNLOAD_URL) private readonly downloadUrl: string | null) {}

  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  page(@Param('token') token: string): string {
    const valid = TOKEN.test(token)
    const deep = valid ? `${ACCOUNT_PROTOCOL}://${INVITE_PATH}/${token}` : ''
    const download = this.downloadUrl
      ? `<p>¿No tienes DayliOS? <a href="${escapeHtml(this.downloadUrl)}">Descárgalo</a> y vuelve a abrir este enlace.</p>`
      : ''
    return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Invitación a DayliOS</title>
<body style="font:15px -apple-system,system-ui,sans-serif;background:#1e1e1e;color:#dadada;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
<main style="max-width:420px;text-align:center">
${
  valid
    ? `<h1 style="font-size:20px">Te invitaron a una organización</h1>
<p><a href="${escapeHtml(deep)}" style="display:inline-block;background:#8a5cf5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Abrir en DayliOS</a></p>
${download}
<script>location.href=${JSON.stringify(deep)}</script>`
    : '<p>Este enlace de invitación no es válido.</p>'
}
</main></body></html>`
  }
}
