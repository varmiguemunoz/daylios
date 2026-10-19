import { EmailProviderError, kindForStatus } from '../../domain/errors'

const FATAL_CODES = ['missing_api_key', 'invalid_api_key', 'restricted_api_key']

export const resendError = (
  message: string,
  code: string,
  status: number | null
): EmailProviderError =>
  new EmailProviderError(
    message,
    'resend',
    code,
    status,
    FATAL_CODES.includes(code) ? 'fatal' : kindForStatus(status)
  )
