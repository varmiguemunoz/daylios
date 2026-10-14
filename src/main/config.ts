import { randomUUID } from 'crypto'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { Settings, SettingsInput } from '@shared/consultora'
import { EDITIONS, type Edition } from '@shared/edition'
import { NOTIFY_DEFAULTS, NOTIFY_KINDS, type NotifySettings } from '@shared/activity'
import { AppError } from './services/app.error'

interface StoredSettings {
  openaiApiKey: string
  docsPath: string

  workspacePath: string
  transcribeModel: string
  summaryModel: string
  summaryLanguage: string
  voiceShortcut: string

  workspaceShortcut: string
  voiceEnabled: boolean
  // ---- Email marketing ----
  resendApiKey: string

  fromEmail: string
  fromName: string
  replyTo: string

  ownerEmail: string

  hubUrl: string
  hubAdminToken: string
  newsletterPaused: boolean

  edition: Edition
  /** Id de este Mac en la lista de dispositivos de la cuenta. Se crea una vez. */
  deviceId: string
  activeOrg: { id: string; name: string } | null
  orgFolders: Record<string, string>
  syncRecordings: boolean
  notify: NotifySettings
  presenceHidden: boolean
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DEFAULTS: StoredSettings = {
  openaiApiKey: '',
  docsPath: '~/Desktop/alimunozadvisory',
  workspacePath: '',
  transcribeModel: 'whisper-1',
  summaryModel: 'gpt-4o-mini',
  summaryLanguage: 'es',
  voiceShortcut: 'Alt+Space',
  workspaceShortcut: 'Alt+CommandOrControl+W',
  voiceEnabled: true,
  resendApiKey: '',
  fromEmail: '',
  fromName: '',
  replyTo: '',
  ownerEmail: '',
  hubUrl: '',
  hubAdminToken: '',
  newsletterPaused: false,
  edition: 'local',
  deviceId: '',
  activeOrg: null,
  orgFolders: {},
  syncRecordings: false,
  notify: { ...NOTIFY_DEFAULTS },
  presenceHidden: false
}

let file = ''
let current: StoredSettings = { ...DEFAULTS }

export function loadConfig(dataDir: string): void {
  file = join(dataDir, 'settings.json')
  if (!existsSync(file)) return
  try {
    current = { ...DEFAULTS, ...JSON.parse(readFileSync(file, 'utf8')) }
  } catch {
    current = { ...DEFAULTS } // archivo dañado: se reescribe en el próximo guardado
  }
}

const expandHome = (path: string): string =>
  path.startsWith('~') ? join(homedir(), path.slice(1)) : path

const orgDocs = (): string | null => {
  const org = current.activeOrg
  if (!org) return null
  const folder = current.orgFolders[org.id] ?? org.id.slice(0, 8)
  return join(expandHome(current.docsPath), 'Organizaciones', folder)
}

export const config = {
  docsPath: (): string => orgDocs() ?? expandHome(current.docsPath),
  workspacePath: (): string => {
    const org = orgDocs()
    if (org) return join(org, 'Workspace')
    return current.workspacePath
      ? expandHome(current.workspacePath)
      : join(expandHome(current.docsPath), 'Workspace')
  },
  activeOrg: (): { id: string; name: string } | null => current.activeOrg,
  syncRecordings: (): boolean => current.syncRecordings === true,
  notify: (): NotifySettings =>
    Object.fromEntries(
      NOTIFY_KINDS.map((k) => [k, current.notify?.[k] !== false])
    ) as NotifySettings,
  presenceHidden: (): boolean => current.presenceHidden === true,
  openaiKey: (): string => current.openaiApiKey,
  transcribeModel: (): string => current.transcribeModel,
  summaryModel: (): string => current.summaryModel,
  summaryLanguage: (): string => current.summaryLanguage,
  voiceShortcut: (): string => current.voiceShortcut,
  workspaceShortcut: (): string => current.workspaceShortcut,
  voiceEnabled: (): boolean => current.voiceEnabled,
  resendKey: (): string => current.resendApiKey,

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
  newsletterPaused: (): boolean => current.newsletterPaused,

  edition: (): Edition => (EDITIONS.includes(current.edition) ? current.edition : 'local')
}

const hint = (secret: string): string => (secret ? `…${secret.slice(-4)}` : '')

export function publicSettings(): Settings {
  const key = current.openaiApiKey
  return {
    docsPath: config.docsPath(),
    workspacePath: config.workspacePath(),
    hasApiKey: Boolean(key),
    apiKeyHint: key ? `…${key.slice(-4)}` : '',
    transcribeModel: current.transcribeModel,
    summaryModel: current.summaryModel,
    summaryLanguage: current.summaryLanguage,
    voiceShortcut: current.voiceShortcut,
    workspaceShortcut: current.workspaceShortcut,
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
  if (input.workspacePath !== undefined) {
    next.workspacePath = clean(input.workspacePath, 'La carpeta del workspace', 1000)
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

  if (input.workspaceShortcut !== undefined) {
    next.workspaceShortcut = clean(input.workspaceShortcut, 'El atajo del workspace', 60)
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

  persist(next)
  return publicSettings()
}

function persist(next: StoredSettings): void {
  writeFileSync(file, JSON.stringify(next, null, 2), { mode: 0o600 })
  chmodSync(file, 0o600)
  current = next
}

/** La edición la cambia la cuenta: Equipo al iniciar sesión, Local al cerrarla. */
export function saveEdition(edition: Edition): void {
  if (current.edition !== edition) persist({ ...current, edition })
}

/** Id estable de este dispositivo, creado la primera vez que se pide. */
export function deviceId(): string {
  if (!current.deviceId) persist({ ...current, deviceId: randomUUID() })
  return current.deviceId
}

const folderFor = (name: string, id: string): string =>
  `${
    name
      .replace(/[/:\\*?"<>|.]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || 'Organización'
  } ${id.slice(0, 8)}`

export function saveActiveOrg(org: { id: string; name: string } | null): void {
  const orgFolders = { ...current.orgFolders }
  if (org && !orgFolders[org.id]) orgFolders[org.id] = folderFor(org.name, org.id)
  persist({ ...current, activeOrg: org, orgFolders })
}

export function dataRoot(userData: string): string {
  return current.activeOrg ? join(userData, 'orgs', current.activeOrg.id) : userData
}

export function orgPaths(userData: string, orgId: string): { data: string; docs: string } | null {
  const folder = current.orgFolders[orgId]
  if (!folder) return null
  return {
    data: join(userData, 'orgs', orgId),
    docs: join(expandHome(current.docsPath), 'Organizaciones', folder)
  }
}

export function saveSyncRecordings(on: boolean): void {
  persist({ ...current, syncRecordings: on })
}

export function saveNotify(settings: NotifySettings): void {
  const notify = Object.fromEntries(
    NOTIFY_KINDS.map((k) => [k, settings[k] !== false])
  ) as NotifySettings
  persist({ ...current, notify })
}

export function savePresenceHidden(hidden: boolean): void {
  persist({ ...current, presenceHidden: hidden })
}
