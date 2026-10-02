import { chmodSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { Settings, SettingsInput } from '@shared/consultora'
import { AppError } from './services/app.error'

/**
 * Ajustes de la Consultora, editables desde la ventana (Ajustes). Se guardan en
 * `<userData>/settings.json` con permisos 600 (solo tu usuario puede leerlo).
 * Los cambios aplican al momento: no hace falta reiniciar.
 */
interface StoredSettings {
  openaiApiKey: string
  docsPath: string
  transcribeModel: string
  summaryModel: string
  summaryLanguage: string
  voiceShortcut: string
  voiceEnabled: boolean
  // ---- Email marketing ----
  resendApiKey: string
  /** Remitente verificado en Resend, p. ej. hola@tudominio.com */
  fromEmail: string
  fromName: string
  replyTo: string
  /** Recibe la copia previa de cada newsletter. */
  ownerEmail: string
  /** URL del Worker `leads-hub` (https://…workers.dev). */
  hubUrl: string
  hubAdminToken: string
  newsletterPaused: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DEFAULTS: StoredSettings = {
  openaiApiKey: '',
  docsPath: '~/Desktop/alimunozadvisory',
  transcribeModel: 'whisper-1',
  summaryModel: 'gpt-4o-mini',
  summaryLanguage: 'es',
  voiceShortcut: 'Alt+Space',
  voiceEnabled: true,
  resendApiKey: '',
  fromEmail: '',
  fromName: '',
  replyTo: '',
  ownerEmail: '',
  hubUrl: '',
  hubAdminToken: '',
  newsletterPaused: false
}

let file = ''
let current: StoredSettings = { ...DEFAULTS }

/** Lee settings.json al arrancar. Si no existe, empieza con los valores por defecto. */
export function loadConfig(dataDir: string): void {
  file = join(dataDir, 'settings.json')
  if (!existsSync(file)) return
  try {
    current = { ...DEFAULTS, ...JSON.parse(readFileSync(file, 'utf8')) }
  } catch {
    current = { ...DEFAULTS } // archivo dañado: se reescribe en el próximo guardado
  }
}

/** `~/x` → `/Users/<tú>/x` */
const expandHome = (path: string): string =>
  path.startsWith('~') ? join(homedir(), path.slice(1)) : path

export const config = {
  docsPath: (): string => expandHome(current.docsPath),
  openaiKey: (): string => current.openaiApiKey,
  transcribeModel: (): string => current.transcribeModel,
  summaryModel: (): string => current.summaryModel,
  summaryLanguage: (): string => current.summaryLanguage,
  voiceShortcut: (): string => current.voiceShortcut,
  voiceEnabled: (): boolean => current.voiceEnabled,
  resendKey: (): string => current.resendApiKey,
  /** "Nombre <email>" o solo el email. Vacío si falta el email. */
  from: (): string =>
    current.fromEmail
      ? current.fromName
        ? `${current.fromName.replace(/[<>"]/g, '')} <${current.fromEmail}>`
        : current.fromEmail
      : '',
  replyTo: (): string => current.replyTo,
  ownerEmail: (): string => current.ownerEmail,
  hubUrl: (): string => current.hubUrl.replace(/\/+$/, ''),
  hubToken: (): string => current.hubAdminToken,
  newsletterPaused: (): boolean => current.newsletterPaused
}

/** Últimos 4 caracteres de un secreto, para reconocerlo sin mostrarlo. */
const hint = (secret: string): string => (secret ? `…${secret.slice(-4)}` : '')

/** Lo que la ventana puede ver: nunca la API key completa. */
export function publicSettings(): Settings {
  const key = current.openaiApiKey
  return {
    docsPath: config.docsPath(),
    hasApiKey: Boolean(key),
    apiKeyHint: key ? `…${key.slice(-4)}` : '',
    transcribeModel: current.transcribeModel,
    summaryModel: current.summaryModel,
    summaryLanguage: current.summaryLanguage,
    voiceShortcut: current.voiceShortcut,
    voiceEnabled: current.voiceEnabled,
    hasResendKey: Boolean(current.resendApiKey),
    resendKeyHint: hint(current.resendApiKey),
    fromEmail: current.fromEmail,
    fromName: current.fromName,
    replyTo: current.replyTo,
    ownerEmail: current.ownerEmail,
    hubUrl: current.hubUrl,
    hasHubToken: Boolean(current.hubAdminToken),
    hubTokenHint: hint(current.hubAdminToken),
    newsletterPaused: current.newsletterPaused
  }
}

/** Valida y guarda. Solo cambia los campos que vienen. */
export function saveSettings(input: SettingsInput): Settings {
  const next = { ...current }
  const clean = (value: unknown, label: string, max = 200): string => {
    if (typeof value !== 'string') throw new AppError('invalid', `${label} debe ser texto.`)
    const text = value.trim()
    if (text.length > max) throw new AppError('invalid', `${label} es demasiado largo.`)
    return text
  }

  if (input.openaiApiKey !== undefined) {
    const key = clean(input.openaiApiKey, 'La API key', 400)
    if (key && !key.startsWith('sk-'))
      throw new AppError('invalid', 'La API key de OpenAI empieza por «sk-».')
    next.openaiApiKey = key
  }
  if (input.docsPath !== undefined) {
    const path = clean(input.docsPath, 'La carpeta', 1000)
    if (!path) throw new AppError('invalid', 'Indica una carpeta.')
    next.docsPath = path
  }
  if (input.transcribeModel !== undefined) {
    next.transcribeModel =
      clean(input.transcribeModel, 'El modelo de transcripción') || DEFAULTS.transcribeModel
  }
  if (input.summaryModel !== undefined) {
    next.summaryModel = clean(input.summaryModel, 'El modelo de resumen') || DEFAULTS.summaryModel
  }
  if (input.summaryLanguage !== undefined) {
    next.summaryLanguage = clean(input.summaryLanguage, 'El idioma', 20) || DEFAULTS.summaryLanguage
  }

  if (input.voiceShortcut !== undefined) {
    next.voiceShortcut = clean(input.voiceShortcut, 'El atajo', 60) || DEFAULTS.voiceShortcut
  }
  if (input.voiceEnabled !== undefined) next.voiceEnabled = input.voiceEnabled === true

  const email = (value: unknown, label: string): string => {
    const text = clean(value, label, 254).toLowerCase()
    if (text && !EMAIL.test(text)) throw new AppError('invalid', `${label} no es un email válido.`)
    return text
  }
  if (input.resendApiKey !== undefined) {
    const key = clean(input.resendApiKey, 'La API key de Resend', 400)
    if (key && !key.startsWith('re_'))
      throw new AppError('invalid', 'La API key de Resend empieza por «re_».')
    next.resendApiKey = key
  }
  if (input.fromEmail !== undefined) next.fromEmail = email(input.fromEmail, 'El remitente')
  if (input.fromName !== undefined)
    next.fromName = clean(input.fromName, 'El nombre del remitente', 80)
  if (input.replyTo !== undefined) next.replyTo = email(input.replyTo, '«Responder a»')
  if (input.ownerEmail !== undefined) next.ownerEmail = email(input.ownerEmail, 'Tu email')
  if (input.hubUrl !== undefined) {
    const url = clean(input.hubUrl, 'La URL del hub', 300)
    if (url && !/^https:\/\/[^\s/]+/.test(url))
      throw new AppError('invalid', 'La URL del hub debe empezar por https://')
    next.hubUrl = url.replace(/\/+$/, '')
  }
  if (input.hubAdminToken !== undefined) {
    next.hubAdminToken = clean(input.hubAdminToken, 'El token del hub', 400)
  }
  if (input.newsletterPaused !== undefined) next.newsletterPaused = input.newsletterPaused === true

  writeFileSync(file, JSON.stringify(next, null, 2), { mode: 0o600 })
  chmodSync(file, 0o600)
  current = next
  return publicSettings()
}
