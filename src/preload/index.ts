import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { TasksApi } from '../shared/tasks'
import type { NotesApi } from '../shared/notes'
import type { ConsultoraApi, StopInfo } from '../shared/consultora'
import type { MarketingApi } from '../shared/marketing'
import type { WorkspaceApi } from '../shared/workspace'

/** Cada método llama a su canal en main (ver src/main/ipc.ts). */
const tasks: TasksApi = {
  getDay: (date) => ipcRenderer.invoke('tasks:getDay', date),
  add: (date, title) => ipcRenderer.invoke('tasks:add', date, title),
  update: (id, patch) => ipcRenderer.invoke('tasks:update', id, patch),
  remove: (id) => ipcRenderer.invoke('tasks:remove', id),
  restore: (removed) => ipcRenderer.invoke('tasks:restore', removed),
  moveToDate: (id, date) => ipcRenderer.invoke('tasks:moveToDate', id, date),
  carryOver: (from, to) => ipcRenderer.invoke('tasks:carryOver', from, to),
  history: (query) => ipcRenderer.invoke('tasks:history', query),
  reorder: (date, ids) => ipcRenderer.invoke('tasks:reorder', date, ids),
  tags: () => ipcRenderer.invoke('tasks:tags'),
  get: (id) => ipcRenderer.invoke('tasks:get', id),
  addSubtask: (parentId, title) => ipcRenderer.invoke('tasks:addSubtask', parentId, title),
  reorderSubtasks: (parentId, ids) => ipcRenderer.invoke('tasks:reorderSubtasks', parentId, ids),
  completeSubtasks: (parentId) => ipcRenderer.invoke('tasks:completeSubtasks', parentId),
  tagSummaries: () => ipcRenderer.invoke('tasks:tagSummaries'),
  renameTag: (from, to) => ipcRenderer.invoke('tasks:renameTag', from, to),
  removeTag: (tag) => ipcRenderer.invoke('tasks:removeTag', tag)
}

const notes: NotesApi = {
  list: (page, pageSize) => ipcRenderer.invoke('notes:list', page, pageSize),
  get: (id) => ipcRenderer.invoke('notes:get', id),
  create: (body, links) => ipcRenderer.invoke('notes:create', body, links),
  view: (id) => ipcRenderer.invoke('notes:view', id),
  search: (query, limit) => ipcRenderer.invoke('notes:search', query, limit),
  link: (id, target) => ipcRenderer.invoke('notes:link', id, target),
  unlink: (id, target) => ipcRenderer.invoke('notes:unlink', id, target),
  update: (id, body, expected) => ipcRenderer.invoke('notes:update', id, body, expected),
  settle: (id) => ipcRenderer.invoke('notes:settle', id),
  remove: (id) => ipcRenderer.invoke('notes:remove', id)
}

/** Workspace: un canal `workspace:<método>` por método (ver src/main/ipc.workspace.ts). */
const callWorkspace =
  (method: keyof WorkspaceApi) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(`workspace:${method}`, ...args)

const workspace: WorkspaceApi = {
  info: callWorkspace('info'),
  tree: callWorkspace('tree'),
  explorer: callWorkspace('explorer'),
  list: callWorkspace('list'),
  get: callWorkspace('get'),
  resolve: callWorkspace('resolve'),
  search: callWorkspace('search'),
  createFolder: callWorkspace('createFolder'),
  createNote: callWorkspace('createNote'),
  createBoard: callWorkspace('createBoard'),
  rename: callWorkspace('rename'),
  move: callWorkspace('move'),
  impact: callWorkspace('impact'),
  remove: callWorkspace('remove'),
  upload: callWorkspace('upload'),
  pickFiles: callWorkspace('pickFiles'),
  attach: callWorkspace('attach'),
  readBoard: callWorkspace('readBoard'),
  writeBoard: callWorkspace('writeBoard'),
  reveal: callWorkspace('reveal'),
  openExternal: callWorkspace('openExternal')
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
  voiceStatus: call('voiceStatus'),
  retryVoiceNotes: call('retryVoiceNotes'),
  refreshVoice: call('refreshVoice'),
  workspaceShortcutStatus: call('workspaceShortcutStatus'),
  listClients: call('listClients'),
  getClient: call('getClient'),
  createClient: call('createClient'),
  updateClient: call('updateClient'),
  clientImpact: call('clientImpact'),
  removeClient: call('removeClient'),
  getProject: call('getProject'),
  createProject: call('createProject'),
  updateProject: call('updateProject'),
  removeProject: call('removeProject'),
  listPipelines: call('listPipelines'),
  pipeline: call('pipeline'),
  savePipeline: call('savePipeline'),
  removePipeline: call('removePipeline'),
  removeProspect: call('removeProspect'),
  listStages: call('listStages'),
  saveStages: call('saveStages'),
  getProspect: call('getProspect'),
  createProspect: call('createProspect'),
  updateProspect: call('updateProspect'),
  moveProspect: call('moveProspect'),
  listContacts: call('listContacts'),
  getContact: call('getContact'),
  createContact: call('createContact'),
  updateContact: call('updateContact'),
  removeContact: call('removeContact'),
  subscribeContact: call('subscribeContact'),
  unsubscribeContact: call('unsubscribeContact'),
  tagContact: call('tagContact'),
  promoteContact: call('promoteContact'),
  convertContact: call('convertContact'),
  detachContactProspect: call('detachContactProspect'),
  pickRecording: call('pickRecording'),
  importRecording: call('importRecording'),
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
  openDocument: call('openDocument'),
  writeDocument: call('writeDocument'),
  renameDocument: call('renameDocument'),
  trashDocument: call('trashDocument'),
  appendNote: call('appendNote')
}

/** Email marketing: un canal `marketing:<método>` por método (ver src/main/ipc.marketing.ts). */
const callMarketing =
  (method: keyof MarketingApi) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(`marketing:${method}`, ...args)

const marketing: MarketingApi = {
  listTags: callMarketing('listTags'),
  renameTag: callMarketing('renameTag'),
  setTagAudience: callMarketing('setTagAudience'),
  tagUsage: callMarketing('tagUsage'),
  removeTag: callMarketing('removeTag'),
  status: callMarketing('status'),
  syncNow: callMarketing('syncNow'),
  testResend: callMarketing('testResend'),
  listSources: callMarketing('listSources'),
  createSource: callMarketing('createSource'),
  updateSource: callMarketing('updateSource'),
  rotateSourceSecret: callMarketing('rotateSourceSecret'),
  removeSource: callMarketing('removeSource'),
  testHub: callMarketing('testHub'),
  listRules: callMarketing('listRules'),
  createRule: callMarketing('createRule'),
  updateRule: callMarketing('updateRule'),
  removeRule: callMarketing('removeRule'),
  reorderRules: callMarketing('reorderRules'),
  listSequences: callMarketing('listSequences'),
  setSequenceStatus: callMarketing('setSequenceStatus'),
  listNewsletters: callMarketing('listNewsletters'),
  getNewsletter: callMarketing('getNewsletter'),
  newsletterContext: callMarketing('newsletterContext'),
  setNewsletterPaused: callMarketing('setNewsletterPaused')
}

/** Grabación de reuniones: el renderer captura, main escribe el archivo y procesa. */
const recording = {
  start: () => ipcRenderer.invoke('recording:start'),
  chunk: (id: string, data: Uint8Array) => ipcRenderer.invoke('recording:chunk', id, data),
  stop: (id: string, info: StopInfo) => ipcRenderer.invoke('recording:stop', id, info)
}

/** Pastilla de nota de voz: main avisa start/stop; la pastilla devuelve el audio. */
const voice = {
  onStart: (cb: () => void) => on('voice:start', cb),
  onStop: (cb: () => void) => on('voice:stop', cb),
  finish: (data: Uint8Array, seconds: number) => ipcRenderer.invoke('voice:finish', data, seconds),
  hide: () => ipcRenderer.send('voice:hide')
}

/** Main pide al popover abrir una nota (clic en la notificación «Nota creada»). */
function onNotesOpen(cb: (note: unknown) => void): () => void {
  const listener = (_e: unknown, note: unknown): void => cb(note)
  ipcRenderer.on('notes:open', listener)
  return () => ipcRenderer.removeListener('notes:open', listener)
}

/** Permisos de macOS (pantalla, micrófono, accesibilidad) y reinicio de la app. */
const permissions = {
  check: () => ipcRenderer.invoke('permissions:check'),
  open: (kind: 'screen' | 'microphone' | 'accessibility') =>
    ipcRenderer.invoke('permissions:open', kind),
  restartApp: () => ipcRenderer.invoke('app:restart')
}

/** Suscribe `cb` a un evento enviado por main; devuelve la función para cancelar. */
function on(
  channel: 'window:shown' | 'data:changed' | 'voice:start' | 'voice:stop',
  cb: () => void
): () => void {
  const listener = (): void => cb()
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('api', {
  tasks,
  notes,
  workspace,
  consultora,
  marketing,
  recording,
  permissions,
  voice,
  onNotesOpen,
  hideWindow: () => ipcRenderer.send('window:hide'),
  setWorkspaceActive: (on: boolean) => ipcRenderer.send('workspace:active', on),
  openConsultora: (target?: { client?: string; workspace?: boolean }) =>
    ipcRenderer.send('window:openConsultora', target),
  onConsultoraNavigate: (cb: (target: { client?: string; workspace?: boolean }) => void) => {
    const listener = (_e: unknown, target: { client?: string; workspace?: boolean }): void => cb(target)
    ipcRenderer.on('consultora:navigate', listener)
    return () => ipcRenderer.removeListener('consultora:navigate', listener)
  },
  openPath: (path: string) => ipcRenderer.invoke('shell:open', path),
  /** Ruta en disco de un archivo soltado en la ventana (Electron ya no expone File.path). */
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  onWindowShown: (cb: () => void) => on('window:shown', cb),
  onDataChanged: (cb: () => void) => on('data:changed', cb)
})
