import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { homedir } from 'os'
import { resolve, sep } from 'path'
import { config, publicSettings, saveSettings } from './config'
import type { Consultora } from './consultora'
import { checkPermissions, openPrivacy, restartApp, type Privacy } from './permissions'
import type { VoiceController } from './voice/voice'

/**
 * Canales de la ventana Consultora (ver src/preload). Uno por método.
 * Las escrituras avisan a todas las ventanas (`data:changed`) para que recarguen.
 */
export function registerConsultoraIpc(c: Consultora, notify: () => void, voice: VoiceController): void {
  const read = (channel: string, fn: (...args: never[]) => unknown): void => {
    ipcMain.handle(channel, (_e, ...args) => fn(...(args as never[])))
  }
  const write = (channel: string, fn: (...args: never[]) => Promise<unknown>): void => {
    ipcMain.handle(channel, async (_e, ...args) => {
      const result = await fn(...(args as never[]))
      notify()
      return result
    })
  }

  read('consultora:overview', () => c.context.overview())
  read('consultora:refs', () => c.context.refs())
  read('consultora:search', (q: string) => c.context.search(q))
  read('consultora:settings', () => publicSettings())
  write('consultora:saveSettings', async (input) => {
    const settings = saveSettings(input)
    await voice.refresh() // el atajo de voz puede haber cambiado
    return settings
  })
  read('consultora:voiceStatus', () => voice.status())
  write('consultora:refreshVoice', () => voice.refresh())
  write('consultora:retryVoiceNotes', () => voice.retry())
  read('consultora:testApiKey', () => c.ai.testKey())
  ipcMain.handle('consultora:pickFolder', async (event) => {
    const options: Electron.OpenDialogOptions = {
      defaultPath: config.docsPath(),
      properties: ['openDirectory', 'createDirectory']
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  read('consultora:listClients', (status) => c.clients.list(status))
  read('consultora:getClient', (ref: string) => c.clients.get(ref))
  write('consultora:createClient', (input) => c.clients.create(input))
  write('consultora:updateClient', (ref: string, patch) => c.clients.update(ref, patch))

  read('consultora:getProject', (ref: string) => c.projects.get(ref))
  write('consultora:createProject', (input) => c.projects.create(input))
  write('consultora:updateProject', (ref: string, patch) => c.projects.update(ref, patch))

  read('consultora:pipeline', () => c.prospects.pipeline())
  read('consultora:listStages', () => c.prospects.listStages())
  write('consultora:saveStages', (stages) => c.prospects.saveStages(stages))
  read('consultora:getProspect', (ref: string) => c.prospects.get(ref))
  write('consultora:createProspect', (input) => c.prospects.create(input))
  write('consultora:updateProspect', (ref: string, patch) => c.prospects.update(ref, patch))
  write('consultora:moveProspect', (ref: string, stage: string, index?: number) =>
    c.prospects.move(ref, stage, index)
  )

  read('consultora:listContacts', (filter) => c.contacts.list(filter ?? {}))
  read('consultora:getContact', (id: string) => c.contacts.get(id))
  write('consultora:createContact', (input) => c.contacts.create(input))
  write('consultora:updateContact', (id: string, patch) => c.contacts.update(id, patch))
  write('consultora:removeContact', (id: string) => c.contacts.remove(id))

  ipcMain.handle('consultora:pickRecording', async (event) => {
    const options: Electron.OpenDialogOptions = {
      title: 'Subir grabación',
      properties: ['openFile'],
      filters: [{ name: 'Video o audio', extensions: ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'mp3', 'm4a', 'wav'] }]
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  write('consultora:importRecording', (path: string, info) => c.recordings.import(path, info))

  read('consultora:listMeetings', (filter) => c.meetings.list(filter))
  read('consultora:getMeeting', (id: string) => c.meetings.get(id))
  write('consultora:createMeeting', (input) => c.meetings.create(input))
  write('consultora:updateMeeting', (id: string, patch) => c.meetings.update(id, patch))
  write('consultora:removeMeeting', (id: string) => c.meetings.remove(id))
  write('consultora:updateActionItem', (id: string, index: number, patch) =>
    c.meetings.updateActionItem(id, index, patch)
  )
  write('consultora:processMeeting', (id: string) => c.recordings.process(id))
  read('consultora:suggestAssociation', (title: string) => c.meetings.suggestAssociation(title))
  read('consultora:listActionItems', (filter) => c.meetings.listActionItems(filter))

  read('consultora:listDocuments', (client: string) => c.context.listDocuments(client))
  read('consultora:readDocument', (client: string, path: string) =>
    c.context.readDocument(client, path)
  )
  write('consultora:appendNote', (entity, ref: string, text: string) =>
    c.context.appendNote(entity, ref, text)
  )

  // ---- Permisos de macOS ----
  ipcMain.handle('permissions:check', () => checkPermissions())
  ipcMain.handle('permissions:open', (_e, kind: Privacy) => openPrivacy(kind))
  ipcMain.handle('app:restart', () => restartApp())

  // ---- Grabación ----
  ipcMain.handle('recording:start', () => c.recordings.start())
  ipcMain.handle('recording:chunk', (_e, id: string, data: Uint8Array) =>
    c.recordings.chunk(id, data)
  )
  ipcMain.handle('recording:stop', (_e, id: string, info) => c.recordings.stop(id, info))

  // ---- Finder: abrir archivos o carpetas, solo dentro de tu carpeta personal ----
  // (no solo la carpeta raíz: si la cambias en Ajustes, los clientes antiguos siguen donde estaban)
  ipcMain.handle('shell:open', async (_e, path: string) => {
    const root = resolve(homedir())
    const target = resolve(String(path))
    if (target !== root && !target.startsWith(root + sep))
      throw new Error('Ruta fuera de tu carpeta personal.')
    const error = await shell.openPath(target)
    if (error) throw new Error(error)
  })
}
