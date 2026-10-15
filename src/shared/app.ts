import { join } from 'path'

export const APP_NAME = 'Alisuite'
export const APP_ID = 'com.alimunozadvisory.alisuite'
export const DATA_DIR = 'daily-os'

export function appDataRoot(
  platform: NodeJS.Platform,
  home: string,
  env: NodeJS.ProcessEnv
): string {
  if (platform === 'darwin') return join(home, 'Library', 'Application Support')
  if (platform === 'win32') return env.APPDATA ?? join(home, 'AppData', 'Roaming')
  return env.XDG_CONFIG_HOME ?? join(home, '.config')
}

export const dataDirFor = (
  platform: NodeJS.Platform,
  home: string,
  env: NodeJS.ProcessEnv
): string => join(appDataRoot(platform, home, env), DATA_DIR)

export type UpdateState =
  | { status: 'disabled' | 'idle' | 'checking' | 'none' }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string }

export interface AppInfo {
  version: string
  platform: string
  openAtLogin: boolean
  claudeLinked: boolean
  update: UpdateState
}

export interface AppApi {
  info: () => Promise<AppInfo>
  setOpenAtLogin: (on: boolean) => Promise<AppInfo>
  connectClaude: () => Promise<AppInfo>
  checkUpdates: () => Promise<UpdateState>
  installUpdate: () => Promise<void>
  onUpdate: (cb: (state: UpdateState) => void) => () => void
}
