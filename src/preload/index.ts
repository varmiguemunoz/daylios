import { contextBridge, ipcRenderer } from 'electron'
import type { TasksApi } from '../shared/tasks'
import type { NotesApi } from '../shared/notes'
import type { ConsultoraApi, StopInfo } from '../shared/consultora'

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

const notes: NotesApi = {
  list: (page, pageSize) => ipcRenderer.invoke('notes:list', page, pageSize),
  get: (id) => ipcRenderer.invoke('notes:get', id),
  create: (body) => ipcRenderer.invoke('notes:create', body),
  update: (id, body) => ipcRenderer.invoke('notes:update', id, body),
  remove: (id) => ipcRenderer.invoke('notes:remove', id)
}

/** Ventana Consultora: un canal `consultora:<método>` por método (ver src/main/ipc.consultora.ts). */
const call =
  (method: keyof ConsultoraApi) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(`consultora:${method}`, ...args)

const consultora: ConsultoraApi = {
  overview: call('overview'),
  refs: call('refs'),
  search: call('search'),
  settings: call('settings'),
  saveSettings: call('saveSettings'),
  testApiKey: call('testApiKey'),
  pickFolder: call('pickFolder'),
  listClients: call('listClients'),
  getClient: call('getClient'),
  createClient: call('createClient'),
  updateClient: call('updateClient'),
  getProject: call('getProject'),
  createProject: call('createProject'),
  updateProject: call('updateProject'),
  pipeline: call('pipeline'),
  listStages: call('listStages'),
  saveStages: call('saveStages'),
  getProspect: call('getProspect'),
  createProspect: call('createProspect'),
  updateProspect: call('updateProspect'),
  moveProspect: call('moveProspect'),
  listMeetings: call('listMeetings'),
  getMeeting: call('getMeeting'),
  createMeeting: call('createMeeting'),
  updateMeeting: call('updateMeeting'),
  removeMeeting: call('removeMeeting'),
  updateActionItem: call('updateActionItem'),
  processMeeting: call('processMeeting'),
  suggestAssociation: call('suggestAssociation'),
  listActionItems: call('listActionItems'),
  listDocuments: call('listDocuments'),
  readDocument: call('readDocument'),
  appendNote: call('appendNote')
}

/** Grabación de reuniones: el renderer captura, main escribe el archivo y procesa. */
const recording = {
  start: () => ipcRenderer.invoke('recording:start'),
  chunk: (id: string, data: Uint8Array) => ipcRenderer.invoke('recording:chunk', id, data),
  stop: (id: string, info: StopInfo) => ipcRenderer.invoke('recording:stop', id, info)
}

/** Suscribe `cb` a un evento enviado por main; devuelve la función para cancelar. */
function on(channel: 'window:shown' | 'data:changed', cb: () => void): () => void {
  const listener = (): void => cb()
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('api', {
  tasks,
  notes,
  consultora,
  recording,
  hideWindow: () => ipcRenderer.send('window:hide'),
  openConsultora: () => ipcRenderer.send('window:openConsultora'),
  openPath: (path: string) => ipcRenderer.invoke('shell:open', path),
  onWindowShown: (cb: () => void) => on('window:shown', cb),
  onDataChanged: (cb: () => void) => on('data:changed', cb)
})
