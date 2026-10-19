import { EmailProviderError, kindForStatus } from '../../domain/errors'

export const apolloError = (
  message: string,
  code: string,
  status: number | null
): EmailProviderError =>
  new EmailProviderError(
    message,
    'apollo',
    code,
    status,
    status === 401 || status === 403 ? 'fatal' : kindForStatus(status)
  )

const STATUS_MESSAGE: Record<number, string> = {
  401: 'Apollo rechazó la API key. Revísala en Ajustes, Email.',
  403: 'Apollo pide una API key maestra para esta acción.',
  422: 'Apollo rechazó los datos enviados.',
  429: 'Apollo pidió esperar por límite de peticiones.'
}

export const messageFor = (status: number, detail: string): string =>
  [STATUS_MESSAGE[status] ?? `Apollo respondió ${status}.`, detail].filter(Boolean).join(' ')
