import { contextBridge, ipcRenderer } from 'electron'
import type { TasksApi } from '../shared/tasks'

/** Cada método llama a su canal en main (ver src/main/ipc.ts). */
const tasks: TasksApi = {
  getDay: (date) => ipcRenderer.invoke('tasks:getDay', date),
  add: (date, title) => ipcRenderer.invoke('tasks:add', date, title),
  update: (id, patch) => ipcRenderer.invoke('tasks:update', id, patch),
  remove: (id) => ipcRenderer.invoke('tasks:remove', id),
  restore: (task) => ipcRenderer.invoke('tasks:restore', task),
  moveToDate: (id, date) => ipcRenderer.invoke('tasks:moveToDate', id, date),
  carryOver: (from, to) => ipcRenderer.invoke('tasks:carryOver', from, to),
  history: (query) => ipcRenderer.invoke('tasks:history', query)
}

/** Suscribe `cb` a un evento enviado por main; devuelve la función para cancelar. */
function on(channel: 'window:shown' | 'tasks:changed', cb: () => void): () => void {
  const listener = (): void => cb()
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('api', {
  tasks,
  hideWindow: () => ipcRenderer.send('window:hide'),
  onWindowShown: (cb: () => void) => on('window:shown', cb),
  onTasksChanged: (cb: () => void) => on('tasks:changed', cb)
})
