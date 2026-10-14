import { BrowserWindow, ipcMain } from 'electron'
import {
  ACTIVITY_ENTITIES,
  ACTIVITY_VERBS,
  NOTIFY_KINDS,
  type ActivityFilter,
  type ActivityState,
  type NotifySettings
} from '@shared/activity'
import type { Activity } from './activity'

const text = (v: unknown): string | null => (typeof v === 'string' && v ? v.slice(0, 300) : null)

function cleanFilter(raw: unknown): ActivityFilter {
  const f = (raw ?? {}) as Record<string, unknown>
  const verb = ACTIVITY_VERBS.find((v) => v === f.verb) ?? null
  const entity = ACTIVITY_ENTITIES.find((e) => e === f.entity) ?? null
  return {
    actorId: text(f.actorId),
    verb,
    entity,
    entityId: text(f.entityId),
    limit: Number(f.limit) || undefined
  }
}

const cleanSettings = (raw: unknown): NotifySettings =>
  Object.fromEntries(
    NOTIFY_KINDS.map((k) => [k, (raw as Record<string, unknown> | null)?.[k] !== false])
  ) as NotifySettings

export function broadcastActivity(state: ActivityState): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('activity:changed', state)
}

export function registerActivityIpc(activity: Activity): void {
  ipcMain.handle('activity:state', () => activity.state())
  ipcMain.handle('activity:list', (_e, filter: unknown) => activity.list(cleanFilter(filter)))
  ipcMain.handle('activity:seen', () => activity.markSeen())
  ipcMain.handle('activity:filePath', (_e, id: unknown) =>
    typeof id === 'string' ? activity.filePath(id) : null
  )
  ipcMain.handle('activity:notifications', () => activity.notifications())
  ipcMain.handle('activity:setNotifications', (_e, settings: unknown) =>
    activity.setNotifications(cleanSettings(settings))
  )
}
