import { BrowserWindow, ipcMain } from 'electron'
import type { SyncStatus } from '@shared/sync-protocol'
import type { Sync } from './sync'

export function broadcastSync(status: SyncStatus): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('sync:status', status)
}

export function registerSyncIpc(sync: Sync): void {
  ipcMain.handle('sync:status', () => sync.status())
  ipcMain.handle('sync:now', () => sync.syncNow())
  ipcMain.handle('sync:pause', (_e, paused: boolean) => sync.pause(paused))
  ipcMain.handle('sync:redownload', () => sync.redownload())
  ipcMain.handle('sync:restore', (_e, entity: string, id: string) => sync.restore(entity, id))
  ipcMain.handle('sync:localSummary', () => sync.localSummary())
}
