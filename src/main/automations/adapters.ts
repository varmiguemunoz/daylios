import { Notification } from 'electron'
import { ResendError } from '@shared/resend-gateway'
import { config } from '../config'
import { resendFromConfig } from '../services/resend.provider'
import {
  ExternalError,
  NotConfigured,
  systemClock,
  type EmailPort,
  type HttpPort,
  type NotifierPort,
  type Ports
} from './ports'

export const fetchHttp: HttpPort = {
  async request({ url, method, body, timeoutMs }) {
    if (!url.startsWith('https://'))
      throw new ExternalError('La URL debe empezar por https://.', false)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: method === 'GET' ? undefined : (body ?? undefined),
        signal: controller.signal
      })
      const text = (await res.text()).slice(0, 10_000)
      if (res.status === 429 || res.status >= 500)
        throw new ExternalError(`El servidor respondió ${res.status}.`, true)
      if (res.status >= 400) throw new ExternalError(`El servidor respondió ${res.status}.`, false)
      return { status: res.status, body: text }
    } catch (err) {
      if (err instanceof ExternalError) throw err
      throw new ExternalError(err instanceof Error ? err.message : String(err), true)
    } finally {
      clearTimeout(timer)
    }
  }
}

export const macNotifier: NotifierPort = {
  notify(title, body) {
    if (!Notification.isSupported()) return
    new Notification({ title, body }).show()
  }
}

export const resendEmail: EmailPort = {
  async send({ to, subject, html }) {
    const gateway = resendFromConfig()
    const from = config.from()
    if (!gateway || !from) throw new NotConfigured('Resend no está configurado en este equipo.')
    try {
      await gateway.sendEmail({ from, to, replyTo: config.replyTo() || undefined, subject, html })
    } catch (err) {
      const status = err instanceof ResendError ? err.status : null
      const retryable = status === null || status === 429 || status >= 500
      throw new ExternalError(err instanceof Error ? err.message : String(err), retryable)
    }
  },
  ownerEmail: () => config.ownerEmail() || null
}

export function createPorts(): Ports {
  return { email: resendEmail, http: fetchHttp, notifier: macNotifier, clock: systemClock }
}
