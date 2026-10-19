import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { TasksApi } from '../shared/tasks'
import type { NotesApi } from '../shared/notes'
import type { ConsultoraApi, StopInfo } from '../shared/consultora'
import type { MarketingApi } from '../shared/marketing'
import {
  AUTOMATION_METHODS,
  type AutomationsApi,
  type AutomationsBridge
} from '../shared/automations/api'
import type { WorkspaceApi } from '../shared/workspace'
import type { DashboardApi } from '../shared/metrics'
import type { EditionApi } from '../shared/edition'
import type { AppApi, UpdateState } from '../shared/app'
import type { AccountApi, AccountState } from '../shared/account'
import type { OrgsApi, OrgsState } from '../shared/organizations'
import type { SyncApi, SyncStatus } from '../shared/sync-protocol'
import type { FilesApi, FilesStatus } from '../shared/files'
import type { ActivityApi, ActivityState } from '../shared/activity'
import type { PresenceApi, PresenceState } from '../shared/presence'
import type { RemoteChange } from '../shared/sync-protocol'

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
  removeTag: (tag) => ipcRenderer.invoke('tasks:removeTag', tag),
  board: (query) => ipcRenderer.invoke('tasks:board', query),
  forRecord: (kind, id) => ipcRenderer.invoke('tasks:forRecord', kind, id)
}

const dashboard: DashboardApi = {
  metrics: (query) => ipcRenderer.invoke('dashboard:metrics', query),
  dashboard: () => ipcRenderer.invoke('dashboard:get'),
  saveDashboard: (layout) => ipcRenderer.invoke('dashboard:save', layout),
  resetDashboard: () => ipcRenderer.invoke('dashboard:reset')
}

const appApi: AppApi = {
  info: () => ipcRenderer.invoke('app:info'),
  setOpenAtLogin: (on) => ipcRenderer.invoke('app:setOpenAtLogin', on),
  connectClaude: () => ipcRenderer.invoke('app:connectClaude'),
  checkUpdates: () => ipcRenderer.invoke('app:checkUpdates'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  onUpdate: (cb) => {
    const listener = (_e: IpcRendererEvent, state: UpdateState): void => cb(state)
    ipcRenderer.on('app:update', listener)
    return () => ipcRenderer.removeListener('app:update', listener)
  }
}

const edition: EditionApi = {
  status: () => ipcRenderer.invoke('edition:status')
}

const account: AccountApi = {
  state: () => ipcRenderer.invoke('account:state'),
  signInWithGoogle: () => ipcRenderer.invoke('account:google'),
  sendEmailCode: (email) => ipcRenderer.invoke('account:sendCode', email),
  verifyEmailCode: (code) => ipcRenderer.invoke('account:verifyCode', code),
  cancel: () => ipcRenderer.invoke('account:cancel'),
  signOut: () => ipcRenderer.invoke('account:signOut'),
  signOutEverywhere: () => ipcRenderer.invoke('account:signOutEverywhere'),
  rename: (name) => ipcRenderer.invoke('account:rename', name),
  devices: () => ipcRenderer.invoke('account:devices'),
  deleteAccount: (confirm) => ipcRenderer.invoke('account:delete', confirm),
  onChanged: (cb) => {
    const listener = (_e: IpcRendererEvent, state: AccountState): void => cb(state)
    ipcRenderer.on('account:changed', listener)
    return () => ipcRenderer.removeListener('account:changed', listener)
  }
}

const orgs: OrgsApi = {
  state: () => ipcRenderer.invoke('orgs:state'),
  refresh: () => ipcRenderer.invoke('orgs:refresh'),
  create: (name, bringLocal) => ipcRenderer.invoke('orgs:create', name, bringLocal),
  switchTo: (orgId) => ipcRenderer.invoke('orgs:switch', orgId),
  detail: () => ipcRenderer.invoke('orgs:detail'),
  rename: (name) => ipcRenderer.invoke('orgs:rename', name),
  remove: (confirm) => ipcRenderer.invoke('orgs:remove', confirm),
  transfer: (userId) => ipcRenderer.invoke('orgs:transfer', userId),
  invite: (input) => ipcRenderer.invoke('orgs:invite', input),
  resendInvite: (id) => ipcRenderer.invoke('orgs:resend', id),
  revokeInvite: (id) => ipcRenderer.invoke('orgs:revoke', id),
  changeRole: (userId, role) => ipcRenderer.invoke('orgs:role', userId, role),
  removeMember: (userId) => ipcRenderer.invoke('orgs:removeMember', userId),
  leave: () => ipcRenderer.invoke('orgs:leave'),
  members: () => ipcRenderer.invoke('orgs:members'),
  authorship: (table, id) => ipcRenderer.invoke('orgs:authorship', table, id),
  onChanged: (cb) => {
    const listener = (_e: IpcRendererEvent, state: OrgsState): void => cb(state)
    ipcRenderer.on('orgs:changed', listener)
    return () => ipcRenderer.removeListener('orgs:changed', listener)
  }
}

const sync: SyncApi = {
  status: () => ipcRenderer.invoke('sync:status'),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  pause: (paused) => ipcRenderer.invoke('sync:pause', paused),
  redownload: () => ipcRenderer.invoke('sync:redownload'),
  restore: (entity, id) => ipcRenderer.invoke('sync:restore', entity, id),
  localSummary: () => ipcRenderer.invoke('sync:localSummary'),
  onStatus: (cb) => {
    const listener = (_e: IpcRendererEvent, status: SyncStatus): void => cb(status)
    ipcRenderer.on('sync:status', listener)
    return () => ipcRenderer.removeListener('sync:status', listener)
  }
}

const activity: ActivityApi = {
  state: () => ipcRenderer.invoke('activity:state'),
  list: (filter) => ipcRenderer.invoke('activity:list', filter),
  markSeen: () => ipcRenderer.invoke('activity:seen'),
  filePath: (id) => ipcRenderer.invoke('activity:filePath', id),
  notifications: () => ipcRenderer.invoke('activity:notifications'),
  setNotifications: (settings) => ipcRenderer.invoke('activity:setNotifications', settings),
  onChanged: (cb) => {
    const listener = (_e: IpcRendererEvent, state: ActivityState): void => cb(state)
    ipcRenderer.on('activity:changed', listener)
    return () => ipcRenderer.removeListener('activity:changed', listener)
  }
}

const presence: PresenceApi = {
  state: () => ipcRenderer.invoke('presence:state'),
  setView: (view) => ipcRenderer.send('presence:view', view),
  setEditing: (editing) => ipcRenderer.send('presence:editing', editing),
  setHidden: (hidden) => ipcRenderer.invoke('presence:hidden', hidden),
  onChanged: (cb) => {
    const listener = (_e: IpcRendererEvent, state: PresenceState): void => cb(state)
    ipcRenderer.on('presence:changed', listener)
    return () => ipcRenderer.removeListener('presence:changed', listener)
  }
}

const files: FilesApi = {
  status: () => ipcRenderer.invoke('files:status'),
  usage: () => ipcRenderer.invoke('files:usage'),
  setRecordings: (on) => ipcRenderer.invoke('files:recordings', on),
  syncNow: () => ipcRenderer.invoke('files:now'),
  trash: () => ipcRenderer.invoke('files:trash'),
  onStatus: (cb) => {
    const listener = (_e: IpcRendererEvent, status: FilesStatus): void => cb(status)
    ipcRenderer.on('files:status', listener)
    return () => ipcRenderer.removeListener('files:status', listener)
  }
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
  fileBytes: callWorkspace('fileBytes'),
  reveal: callWorkspace('reveal'),
  openExternal: callWorkspace('openExternal')
}

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
  emailProviders: callMarketing('emailProviders'),
  testProvider: callMarketing('testProvider'),
  outreachStatus: callMarketing('outreachStatus'),
  listOutreachSequences: callMarketing('listOutreachSequences'),
  saveOutreachSequence: callMarketing('saveOutreachSequence'),
  setOutreachSequenceStatus: callMarketing('setOutreachSequenceStatus'),
  enrollOutreach: callMarketing('enrollOutreach'),
  pollOutreach: callMarketing('pollOutreach'),
  listSources: callMarketing('listSources'),
  createSource: callMarketing('createSource'),
  updateSource: callMarketing('updateSource'),
  rotateSourceSecret: callMarketing('rotateSourceSecret'),
  removeSource: callMarketing('removeSource'),
  testHub: callMarketing('testHub'),
  listSequences: callMarketing('listSequences'),
  setSequenceStatus: callMarketing('setSequenceStatus'),
  listNewsletters: callMarketing('listNewsletters'),
  getNewsletter: callMarketing('getNewsletter'),
  newsletterContext: callMarketing('newsletterContext'),
  setNewsletterPaused: callMarketing('setNewsletterPaused')
}

const recording = {
  start: () => ipcRenderer.invoke('recording:start'),
  chunk: (id: string, data: Uint8Array) => ipcRenderer.invoke('recording:chunk', id, data),
  stop: (id: string, info: StopInfo) => ipcRenderer.invoke('recording:stop', id, info)
}

const voice = {
  onStart: (cb: () => void) => on('voice:start', cb),
  onStop: (cb: () => void) => on('voice:stop', cb),
  finish: (data: Uint8Array, seconds: number) => ipcRenderer.invoke('voice:finish', data, seconds),
  hide: () => ipcRenderer.send('voice:hide')
}

function onNotesOpen(cb: (note: unknown) => void): () => void {
  const listener = (_e: unknown, note: unknown): void => cb(note)
  ipcRenderer.on('notes:open', listener)
  return () => ipcRenderer.removeListener('notes:open', listener)
}

const permissions = {
  check: () => ipcRenderer.invoke('permissions:check'),
  open: (kind: 'screen' | 'microphone' | 'accessibility') =>
    ipcRenderer.invoke('permissions:open', kind),
  restartApp: () => ipcRenderer.invoke('app:restart')
}

interface ConsultoraTarget {
  client?: string
  workspace?: boolean
  account?: boolean
  open?: { entity: string; id: string }
}

const ui = {
  load: () => ipcRenderer.invoke('ui:load'),
  patch: (changes: Record<string, unknown>) => ipcRenderer.send('ui:patch', changes),
  reset: () => ipcRenderer.invoke('ui:reset'),
  setMenubarPinned: (pinned: boolean) => ipcRenderer.invoke('ui:menubarPin', pinned)
}

function on(
  channel: 'window:shown' | 'data:changed' | 'voice:start' | 'voice:stop' | 'automations:changed',
  cb: () => void
): () => void {
  const listener = (): void => cb()
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const callAutomations =
  (method: keyof AutomationsApi) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(`automations:${method}`, ...args)

const automations = {
  ...Object.fromEntries(AUTOMATION_METHODS.map((m) => [m, callAutomations(m)])),
  onChanged: (cb: () => void) => on('automations:changed', cb)
} as AutomationsBridge

contextBridge.exposeInMainWorld('api', {
  app: appApi,
  ui,
  tasks,
  dashboard,
  edition,
  account,
  orgs,
  sync,
  files,
  activity,
  presence,
  notes,
  workspace,
  consultora,
  marketing,
  automations,
  recording,
  permissions,
  voice,
  onNotesOpen,
  hideWindow: () => ipcRenderer.send('window:hide'),
  setWorkspaceActive: (on: boolean) => ipcRenderer.send('workspace:active', on),
  openConsultora: (target?: { client?: string; workspace?: boolean }) =>
    ipcRenderer.send('window:openConsultora', target),
  onConsultoraNavigate: (cb: (target: ConsultoraTarget) => void) => {
    const listener = (_e: unknown, target: ConsultoraTarget): void => cb(target)
    ipcRenderer.on('consultora:navigate', listener)
    return () => ipcRenderer.removeListener('consultora:navigate', listener)
  },
  openPath: (path: string) => ipcRenderer.invoke('shell:open', path),
  revealPath: (path: string) => ipcRenderer.invoke('shell:reveal', path),
  platform: process.platform,

  pathForFile: (file: File) => webUtils.getPathForFile(file),
  onWindowShown: (cb: () => void) => on('window:shown', cb),
  onDataChanged: (cb: () => void) => on('data:changed', cb),
  onRemoteChanges: (cb: (changes: RemoteChange[]) => void) => {
    const listener = (_e: IpcRendererEvent, changes: RemoteChange[]): void => cb(changes)
    ipcRenderer.on('data:remote', listener)
    return () => ipcRenderer.removeListener('data:remote', listener)
  }
})
