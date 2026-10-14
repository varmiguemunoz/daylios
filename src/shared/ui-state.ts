export const UI_STATE_VERSION = 1

export type UiValues = Record<string, unknown>

export type UiPatch = Record<string, unknown>

export interface UiStateFile {
  version: number
  values: UiValues
}

export const TRIMMED_PREFIXES = ['scroll.', 'board.viewport:'] as const
export const MAX_TRIMMED = 500
export const MAX_BYTES = 2 * 1024 * 1024
export const MAX_KEY = 200

export const MENUBAR_WINDOW_KEY = 'menubar.window'
export const CONSULTORA_WINDOW_KEY = 'consultora.window'

export interface MenubarWindowState {
  pinned: boolean
  x?: number
  y?: number
  height?: number
}

export interface WindowBoundsState {
  x: number
  y: number
  width: number
  height: number
  maximized?: boolean
  fullscreen?: boolean
}

export interface UiStateApi {
  load(): Promise<UiValues>

  patch(changes: UiPatch): void

  reset(): Promise<void>

  setMenubarPinned(pinned: boolean): Promise<MenubarWindowState>
}

const isTrimmed = (key: string): boolean => TRIMMED_PREFIXES.some((p) => key.startsWith(p))

export function parseUiState(text: string | null): UiValues {
  if (!text) return {}
  try {
    const parsed = JSON.parse(text) as Partial<UiStateFile>
    if (parsed?.version !== UI_STATE_VERSION) return {}
    const values = parsed.values
    return values && typeof values === 'object' && !Array.isArray(values) ? { ...values } : {}
  } catch {
    return {}
  }
}

export function applyPatch(values: UiValues, changes: UiPatch): UiValues {
  const next = { ...values }
  for (const [key, value] of Object.entries(changes)) {
    if (typeof key !== 'string' || !key || key.length > MAX_KEY) continue
    delete next[key]
    if (value !== null && value !== undefined) next[key] = value
  }
  return next
}

export function trimValues(values: UiValues, max = MAX_TRIMMED, maxBytes = MAX_BYTES): UiValues {
  const next = { ...values }
  const trimmed = Object.keys(next).filter(isTrimmed)
  for (const key of trimmed.slice(0, Math.max(0, trimmed.length - max))) delete next[key]
  let rest = Object.keys(next).filter(isTrimmed)
  while (rest.length && JSON.stringify(next).length > maxBytes) {
    delete next[rest[0]]
    rest = rest.slice(1)
  }
  return next
}

export const serializeUiState = (values: UiValues): string =>
  JSON.stringify({ version: UI_STATE_VERSION, values } satisfies UiStateFile)
