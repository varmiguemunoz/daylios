import { app } from 'electron'
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'

const MARKER = 'login-item'

export const openAtLogin = (): boolean => app.getLoginItemSettings().openAtLogin

export function setOpenAtLogin(on: boolean): boolean {
  app.setLoginItemSettings({ openAtLogin: on })
  return openAtLogin()
}

export function initLoginItem(dataDir: string): void {
  const marker = join(dataDir, MARKER)
  if (!app.isPackaged || existsSync(marker)) return
  setOpenAtLogin(true)
  writeFileSync(marker, new Date().toISOString())
}
