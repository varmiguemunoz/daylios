import { readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  applyPatch,
  parseUiState,
  serializeUiState,
  trimValues,
  type UiPatch,
  type UiValues
} from '@shared/ui-state'

const WAIT_MS = 500

export class UiStateStore {
  private values: UiValues = {}
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly file: string) {
    let text: string | null = null
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      // primera vez
    }
    this.values = parseUiState(text)
  }

  all(): UiValues {
    return { ...this.values }
  }

  get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined
  }

  patch(changes: UiPatch): void {
    this.values = trimValues(applyPatch(this.values, changes))
    this.schedule()
  }

  reset(): void {
    this.values = { 'migrated.localStorage': true }
    this.flush()
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    try {
      const tmp = `${this.file}.tmp`
      writeFileSync(tmp, serializeUiState(this.values), 'utf8')
      renameSync(tmp, this.file)
    } catch (error) {
      console.error('[ui-state] no se pudo guardar', error)
    }
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), WAIT_MS)
  }
}

let store: UiStateStore | null = null

export function initUiState(dataDir: string): UiStateStore {
  store = new UiStateStore(join(dataDir, 'ui-state.json'))
  return store
}

export function uiState(): UiStateStore {
  if (!store) throw new Error('ui-state sin iniciar')
  return store
}
