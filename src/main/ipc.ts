import { ipcMain } from 'electron'
import type { TaskService } from './services/task.service'
import type { NoteService } from './services/note.service'

/** Canales que usa la ventana (ver src/preload). Uno por método del servicio. */
export function registerIpc(tasks: TaskService, notes: NoteService): void {
  ipcMain.handle('tasks:getDay', (_e, date) => tasks.getDay(date))
  ipcMain.handle('tasks:add', (_e, date, title) => tasks.add(date, title))
  ipcMain.handle('tasks:update', (_e, id, patch) => tasks.update(id, patch))
  ipcMain.handle('tasks:remove', (_e, id) => tasks.remove(id))
  ipcMain.handle('tasks:restore', (_e, task) => tasks.restore(task))
  ipcMain.handle('tasks:moveToDate', (_e, id, date) => tasks.moveToDate(id, date))
  ipcMain.handle('tasks:carryOver', (_e, from, to) => tasks.carryOver(from, to))
  ipcMain.handle('tasks:history', (_e, query) => tasks.history(query))

  ipcMain.handle('notes:list', (_e, page, pageSize) => notes.list(page, pageSize))
  ipcMain.handle('notes:get', (_e, id) => notes.get(id))
  ipcMain.handle('notes:create', (_e, body) => notes.create(body))
  ipcMain.handle('notes:update', (_e, id, body) => notes.update(id, body))
  ipcMain.handle('notes:remove', (_e, id) => notes.remove(id))
}
