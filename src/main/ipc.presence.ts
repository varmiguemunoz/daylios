import { BrowserWindow, ipcMain } from 'electron'
import type { PresenceState, PresenceView } from '@shared/presence'
import type { Presence } from './presence'

const isView = (v: unknown): v is PresenceView =>
  !!v &&
  typeof (v as PresenceView).entity === 'string' &&
  typeof (v as PresenceView).id === 'string'

export function broadcastPresence(state: PresenceState): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('presence:changed', state)
}

export function registerPresenceIpc(presence: Presence): void {
  ipcMain.handle('presence:state', () => presence.state())
  ipcMain.handle('presence:hidden', (_e, hidden: boolean) => presence.setHidden(hidden === true))
  ipcMain.on('presence:view', (_e, view: unknown) => presence.setView(isView(view) ? view : null))
  ipcMain.on('presence:editing', (_e, editing: unknown) => presence.setEditing(editing === true))
}
