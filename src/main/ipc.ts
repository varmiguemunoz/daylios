import { ipcMain } from 'electron'
import type { TaskService } from './services/task.service'
import type { NoteService } from './services/note.service'

/** Canales que usa la ventana (ver src/preload). Uno por método del servicio. */
export function registerIpc(tasks: TaskService, notes: NoteService): void {
  ipcMain.handle('tasks:getDay', (_e, date) => tasks.getDay(date))
  ipcMain.handle('tasks:add', (_e, date, title) => tasks.add(date, title))
  ipcMain.handle('tasks:update', (_e, id, patch) => tasks.update(id, patch))
  ipcMain.handle('tasks:remove', (_e, id) => tasks.remove(id))
  ipcMain.handle('tasks:restore', (_e, removed) => tasks.restore(removed))
  ipcMain.handle('tasks:moveToDate', (_e, id, date) => tasks.moveToDate(id, date))
  ipcMain.handle('tasks:carryOver', (_e, from, to) => tasks.carryOver(from, to))
  ipcMain.handle('tasks:history', (_e, query) => tasks.history(query))
  ipcMain.handle('tasks:reorder', (_e, date, ids) => tasks.reorder(date, ids))
  ipcMain.handle('tasks:tags', () => tasks.tags())
  ipcMain.handle('tasks:get', (_e, id) => tasks.get(id))
  ipcMain.handle('tasks:addSubtask', (_e, parentId, title) => tasks.addSubtask(parentId, title))
  ipcMain.handle('tasks:reorderSubtasks', (_e, parentId, ids) => tasks.reorderSubtasks(parentId, ids))
  ipcMain.handle('tasks:completeSubtasks', (_e, parentId) => tasks.completeSubtasks(parentId))
  ipcMain.handle('tasks:tagSummaries', () => tasks.tagSummaries())
  ipcMain.handle('tasks:renameTag', (_e, from, to) => tasks.renameTag(from, to))
  ipcMain.handle('tasks:removeTag', (_e, tag) => tasks.removeTag(tag))

  ipcMain.handle('notes:list', (_e, page, pageSize) => notes.list(page, pageSize))
  ipcMain.handle('notes:get', (_e, id) => notes.get(id))
  ipcMain.handle('notes:create', (_e, body, links) => notes.create(body, links))
  ipcMain.handle('notes:view', (_e, id) => notes.view(id))
  ipcMain.handle('notes:search', (_e, query, limit) => notes.search(query, limit))
  ipcMain.handle('notes:link', (_e, id, target) => notes.link(id, target))
  ipcMain.handle('notes:unlink', (_e, id, target) => notes.unlink(id, target))
  ipcMain.handle('notes:update', (_e, id, body) => notes.update(id, body))
  ipcMain.handle('notes:remove', (_e, id) => notes.remove(id))
}
