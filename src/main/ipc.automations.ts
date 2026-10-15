import { BrowserWindow, ipcMain } from 'electron'
import { AUTOMATION_METHODS, isAutomationWrite, type AutomationsApi } from '@shared/automations'

export function registerAutomationsIpc(api: AutomationsApi, notify: () => void): void {
  const call = (method: keyof AutomationsApi, args: unknown[]): Promise<unknown> =>
    (api[method] as (...a: unknown[]) => Promise<unknown>).apply(api, args)
  for (const method of AUTOMATION_METHODS)
    ipcMain.handle(`automations:${method}`, async (_e, ...args) => {
      const result = await call(method, args)
      if (isAutomationWrite(method)) notify()
      return result
    })
}

export function runsChangedBroadcaster(delayMs = 500): () => void {
  let timer: NodeJS.Timeout | null = null
  return () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('automations:changed')
    }, delayMs)
  }
}
