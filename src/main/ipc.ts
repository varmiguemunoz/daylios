import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'
import type { TaskService } from './services/task.service'
import type { NoteService } from './services/note.service'

const TASK_WRITES = new Set([
  'tasks:add',
  'tasks:update',
  'tasks:remove',
  'tasks:restore',
  'tasks:moveToDate',
  'tasks:carryOver',
  'tasks:reorder',
  'tasks:addSubtask',
  'tasks:reorderSubtasks',
  'tasks:completeSubtasks',
  'tasks:renameTag',
  'tasks:removeTag'
])

export function registerIpc(
  tasks: TaskService,
  notes: NoteService,
  notifyOthers: (sender: WebContents) => void
): void {
  // Igual que ipcMain.handle, pero las escrituras de tareas avisan al resto de ventanas.
  const handle = (
    channel: string,
    fn: (e: IpcMainInvokeEvent, ...args: never[]) => unknown
  ): void =>
    ipcMain.handle(channel, async (e, ...args) => {
      const result = await fn(e, ...(args as never[]))
      if (TASK_WRITES.has(channel)) notifyOthers(e.sender)
      return result
    })

  handle('tasks:getDay', (_e, date) => tasks.getDay(date))
  handle('tasks:add', (_e, date, title) => tasks.add(date, title))
  handle('tasks:update', (_e, id, patch) => tasks.update(id, patch))
  handle('tasks:remove', (_e, id) => tasks.remove(id))
  handle('tasks:restore', (_e, removed) => tasks.restore(removed))
  handle('tasks:moveToDate', (_e, id, date) => tasks.moveToDate(id, date))
  handle('tasks:carryOver', (_e, from, to) => tasks.carryOver(from, to))
  handle('tasks:history', (_e, query) => tasks.history(query))
  handle('tasks:reorder', (_e, date, ids) => tasks.reorder(date, ids))
  handle('tasks:tags', () => tasks.tags())
  handle('tasks:get', (_e, id) => tasks.get(id))
  handle('tasks:addSubtask', (_e, parentId, title) => tasks.addSubtask(parentId, title))
  handle('tasks:reorderSubtasks', (_e, parentId, ids) => tasks.reorderSubtasks(parentId, ids))
  handle('tasks:completeSubtasks', (_e, parentId) => tasks.completeSubtasks(parentId))
  handle('tasks:tagSummaries', () => tasks.tagSummaries())
  handle('tasks:renameTag', (_e, from, to) => tasks.renameTag(from, to))
  handle('tasks:removeTag', (_e, tag) => tasks.removeTag(tag))
  handle('tasks:board', (_e, query) => tasks.board(query ?? {}))
  handle('tasks:forRecord', (_e, kind, id) => tasks.forRecord(kind, id))

  ipcMain.handle('notes:list', (_e, page, pageSize) => notes.list(page, pageSize))
  ipcMain.handle('notes:get', (_e, id) => notes.get(id))
  ipcMain.handle('notes:create', (_e, body, links) => notes.create(body, links))
  ipcMain.handle('notes:view', (_e, id) => notes.view(id))
  ipcMain.handle('notes:search', (_e, query, limit) => notes.search(query, limit))
  ipcMain.handle('notes:link', (_e, id, target) => notes.link(id, target))
  ipcMain.handle('notes:unlink', (_e, id, target) => notes.unlink(id, target))
  ipcMain.handle('notes:update', (_e, id, body, expected) => notes.update(id, body, expected))
  ipcMain.handle('notes:settle', (_e, id) => notes.settle(id))
  ipcMain.handle('notes:remove', (_e, id) => notes.remove(id))
}
