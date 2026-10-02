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
}

const DEFAULTS: StoredSettings = {
  openaiApiKey: '',
  docsPath: '~/Desktop/alimunozadvisory',
  transcribeModel: 'whisper-1',
  summaryModel: 'gpt-4o-mini',
  summaryLanguage: 'es'
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
  summaryLanguage: (): string => current.summaryLanguage
}

/** Lo que la ventana puede ver: nunca la API key completa. */
export function publicSettings(): Settings {
  const key = current.openaiApiKey
  return {
    docsPath: config.docsPath(),
    hasApiKey: Boolean(key),
    apiKeyHint: key ? `…${key.slice(-4)}` : '',
    transcribeModel: current.transcribeModel,
    summaryModel: current.summaryModel,
    summaryLanguage: current.summaryLanguage
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

  writeFileSync(file, JSON.stringify(next, null, 2), { mode: 0o600 })
  chmodSync(file, 0o600)
  current = next
  return publicSettings()
}
