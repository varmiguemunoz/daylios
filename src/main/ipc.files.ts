import { BrowserWindow, ipcMain } from 'electron'
import type { FilesStatus } from '@shared/files'
import type { Files } from './files'

export function broadcastFiles(status: FilesStatus): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('files:status', status)
}

export function registerFilesIpc(files: Files): void {
  ipcMain.handle('files:status', () => files.status())
  ipcMain.handle('files:usage', () => files.usage())
  ipcMain.handle('files:recordings', (_e, on: boolean) => files.setRecordings(on === true))
  ipcMain.handle('files:now', () => files.syncNow())
  ipcMain.handle('files:trash', () => files.trash())
}
