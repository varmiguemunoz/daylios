import type { EmailSender } from '../../ports/sender'
import { resendError } from './errors'

export function resendHttpSender(apiKey: string, fetchImpl: typeof fetch = fetch): EmailSender {
  return {
    async send({ from, to, replyTo, subject, html, text }) {
      if (!from) throw resendError('Falta el remitente.', 'missing_from', 422)
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
          text,
          ...(replyTo ? { reply_to: replyTo } : {})
        }),
        signal: AbortSignal.timeout(10_000)
      })
      if (!res.ok) throw resendError(`Resend respondió ${res.status}.`, 'http_error', res.status)
      const body = (await res.json().catch(() => ({}))) as { id?: unknown }
      return { id: typeof body.id === 'string' ? body.id : '' }
    }
  }
}
