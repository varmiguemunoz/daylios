import { app, BrowserWindow, ipcMain } from 'electron'
import { homedir } from 'os'
import { join } from 'path'
import type { AppInfo, UpdateState } from '@shared/app'
import { claudeConfigPath, claudeStatus, linkClaude, mcpEntry } from './claude-config'
import { openAtLogin, setOpenAtLogin } from './login-item'
import type { Updater } from './updater'

export function broadcastUpdate(state: UpdateState): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('app:update', state)
}

export function registerAppIpc(updater: Updater): void {
  const claudeFile = claudeConfigPath(process.platform, homedir(), process.env)
  const entry = mcpEntry(process.execPath, join(app.getAppPath(), 'out', 'main', 'mcp.js'))

  const info = async (): Promise<AppInfo> => ({
    version: app.getVersion(),
    platform: process.platform,
    openAtLogin: openAtLogin(),
    claudeLinked: await claudeStatus(claudeFile, entry),
    update: updater.current()
  })

  ipcMain.handle('app:info', info)
  ipcMain.handle('app:setOpenAtLogin', (_e, on: boolean) => {
    setOpenAtLogin(Boolean(on))
    return info()
  })
  ipcMain.handle('app:connectClaude', async () => {
    await linkClaude(claudeFile, entry)
    return info()
  })
  ipcMain.handle('app:checkUpdates', () => updater.check())
  ipcMain.handle('app:installUpdate', () => updater.install())
}
