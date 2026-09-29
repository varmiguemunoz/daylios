import { ipcMain } from 'electron'
import type { TaskService } from './services/task.service'

/** Canales que usa la ventana (ver src/preload). Uno por método del servicio. */
export function registerIpc(service: TaskService): void {
  ipcMain.handle('tasks:getDay', (_e, date) => service.getDay(date))
  ipcMain.handle('tasks:add', (_e, date, title) => service.add(date, title))
  ipcMain.handle('tasks:update', (_e, id, patch) => service.update(id, patch))
  ipcMain.handle('tasks:remove', (_e, id) => service.remove(id))
  ipcMain.handle('tasks:restore', (_e, task) => service.restore(task))
  ipcMain.handle('tasks:moveToDate', (_e, id, date) => service.moveToDate(id, date))
  ipcMain.handle('tasks:carryOver', (_e, from, to) => service.carryOver(from, to))
  ipcMain.handle('tasks:history', (_e, query) => service.history(query))
}
