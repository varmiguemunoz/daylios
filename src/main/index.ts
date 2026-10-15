import { fromApp } from './vault-guard'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  Notification,
  powerMonitor,
  protocol,
  safeStorage,
  shell
} from 'electron'
import { pathToFileURL } from 'url'
import { optimizer } from '@electron-toolkit/utils'
import { openDatabase } from './db/data-source'
import { AutomationEngine } from './automations/engine'
import { AutomationService } from './automations/service'
import { registerAutomationsIpc, runsChangedBroadcaster } from './ipc.automations'
import { createHandlers } from './automations/handlers'
import { createPorts, macNotifier } from './automations/adapters'
import { maintainDatabase } from './db/change-log'
import { cloud, loadEdition } from './edition'
import { registerEditionIpc } from './ipc.edition'
import { Account } from './account'
import { Organizations } from './organizations'
import { broadcastOrgs, registerOrgsIpc } from './ipc.orgs'
import { SYNC_MARKER, Sync } from './sync'
import { Files } from './files'
import { broadcastFiles, registerFilesIpc } from './ipc.files'
import { broadcastSync, registerSyncIpc } from './ipc.sync'
import { Activity } from './activity'
import { broadcastActivity, registerActivityIpc } from './ipc.activity'
import { Presence } from './presence'
import { broadcastPresence, registerPresenceIpc } from './ipc.presence'
import { setTeamUser } from './scope'
import { broadcastAccount, registerAccountIpc } from './ipc.account'
import { setAuthor } from './db/author'
import { ACCOUNT_PROTOCOL } from '@shared/account'
import {
  config,
  dataRoot,
  deviceId,
  loadConfig,
  orgPaths,
  saveActiveOrg,
  saveEdition,
  saveNotify,
  savePresenceHidden,
  saveSyncRecordings
} from './config'
import { TaskService } from './services/task.service'
import { NoteService } from './services/note.service'
import { moveNotesToVault } from './services/notes-to-vault'
import { createConsultora } from './consultora'
import { registerIpc } from './ipc'
import { registerUiIpc } from './ipc.ui'
import { initUiState } from './services/ui-state'
import { registerConsultoraIpc } from './ipc.consultora'
import { createMarketing } from './marketing'
import { registerMarketingIpc } from './ipc.marketing'
import { resendFromConfig } from './services/resend.provider'
import { hubFromConfig } from './services/hub.client'
import { startServer } from './server'
import { createMenubarWindow, createTray } from './window'
import {
  allowScreenCapture,
  openConsultoraAt,
  resetConsultoraBounds,
  showConsultora
} from './consultora-window'
import { WorkspaceShortcut } from './workspace-shortcut'
import { VoiceNoteService } from './services/voice-note.service'
import { VoiceController, notifyNoteCreated } from './voice/voice'
import { disposeVoiceShortcut } from './voice/shortcut'
import { noteTitle, type Note } from '@shared/notes'
import { setTrash } from './services/trash'
import { Vault } from './services/vault'
import { WorkspaceService } from './services/workspace.service'
import { WorkspaceWatcher } from './services/workspace-watcher'
import { registerWorkspaceIpc } from './ipc.workspace'

// Audio del sistema al grabar pantalla en macOS (ScreenCaptureKit). Debe ir antes de `ready`.
app.commandLine.appendSwitch(
  'enable-features',
  'MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride'
)

// Imágenes de la bóveda del workspace: `vault://item/<id>` y `vault://path/<ruta>`. Antes de `ready`.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vault',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

let account: Account | null = null
let orgs: Organizations | null = null
let pendingUrl: string | null = null
app.on('open-url', (event, url) => {
  event.preventDefault()
  if (account?.handleUrl(url)) return
  if (orgs) orgs.handleUrl(url)
  else pendingUrl = url
})

// Una sola instancia: un segundo arranque abre la ventana existente.
if (!app.requestSingleInstanceLock()) app.quit()
else app.whenReady().then(start)

async function start(): Promise<void> {
  // App de menubar: sin icono en el Dock.
  // El arranque al iniciar sesión lo gestiona el servicio de launchd (scripts/install.sh).
  app.dock?.hide()

  const dataDir = app.getPath('userData')
  loadConfig(dataDir)
  // Estado de la interfaz (ui-state.json): antes de crear las ventanas, que lo leen.
  const ui = initUiState(dataDir)
  app.on('before-quit', () => ui.flush())
  setTrash((path) => shell.trashItem(path))
  const db = await openDatabase(dataRoot(dataDir))
  if (app.isPackaged) app.setAsDefaultProtocolClient(ACCOUNT_PROTOCOL)
  account = new Account({
    dataDir,
    packaged: app.isPackaged,
    cipher: safeStorage,
    openExternal: async (url) => {
      if (url.startsWith('https://')) await shell.openExternal(url)
    },
    deviceId,
    switchEdition: async (edition, auth) => {
      saveEdition(edition)
      await loadEdition(edition, auth ?? undefined)
    },
    setAuthor,
    onChanged: broadcastAccount
  })
  await account.init(config.edition()).catch((error) => console.error('[cuenta]', error))
  app.on('before-quit', () => {
    account?.dispose()
    const adapters = cloud()
    void Promise.all([adapters.sync.stop(), adapters.files.stop(), adapters.presence.stop()])
  })
  await maintainDatabase(db, config.edition()).catch((error) =>
    console.error('[db] mantenimiento', error)
  )
  registerEditionIpc()
  registerAccountIpc(account)
  orgs = new Organizations({
    account,
    db,
    userData: dataDir,
    active: config.activeOrg,
    saveActive: saveActiveOrg,
    paths: (orgId) => orgPaths(dataDir, orgId),
    trash: (path) => shell.trashItem(path),
    relaunch: (notice) => {
      if (notice) dialog.showMessageBoxSync({ type: 'info', message: notice, buttons: ['Aceptar'] })
      app.relaunch()
      app.exit(0)
    },
    openAccount: () => openConsultoraAt({ account: true }),
    workspacePath: config.workspacePath,
    markerName: SYNC_MARKER,
    onChanged: broadcastOrgs
  })
  registerOrgsIpc(orgs)
  await orgs.init().catch((error) => console.error('[organizaciones]', error))
  if (pendingUrl) orgs.handleUrl(pendingUrl)

  // Avisa a todas las ventanas de que algo cambió (Claude, grabación, otra ventana).
  const notify = (): void => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('data:changed')
    sync.poke()
  }

  const teamScope = (): void => setTeamUser(config.activeOrg() ? (account?.userId() ?? null) : null)
  teamScope()
  account.onChange(teamScope)
  const sync = new Sync({
    db,
    account,
    dataRoot: dataRoot(dataDir),
    docsPath: config.docsPath,
    activeOrg: config.activeOrg,
    deviceId,
    notify: (changes) => {
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send('data:changed')
        if (changes?.length) w.webContents.send('data:remote', changes)
      }
      files.poke()
      activity.poke()
    },
    onStatus: broadcastSync
  })
  registerSyncIpc(sync)
  const activity = new Activity({
    db,
    account,
    activeOrg: config.activeOrg,
    settings: config.notify,
    saveSettings: saveNotify,
    memberName: async (userId) => {
      const list = (await orgs?.members().catch(() => [])) ?? []
      const m = list.find((x) => x.userId === userId)
      return m?.name ?? m?.email ?? 'Alguien'
    },
    alert: (entry, text) => {
      if (!Notification.isSupported()) return
      const n = new Notification({ title: 'DayliOS', body: text })
      n.on('click', () => openConsultoraAt({ open: { entity: entry.entity, id: entry.entityId } }))
      n.show()
    },
    onState: broadcastActivity
  })
  registerActivityIpc(activity)
  const presence = new Presence({
    account,
    activeOrg: config.activeOrg,
    hidden: config.presenceHidden,
    saveHidden: savePresenceHidden,
    onState: broadcastPresence
  })
  registerPresenceIpc(presence)
  const files = new Files({
    db,
    account,
    root: config.docsPath,
    activeOrg: config.activeOrg,
    recordings: config.syncRecordings,
    saveRecordings: saveSyncRecordings,
    trash: (full) => shell.trashItem(full),
    onManifestChange: () => sync.poke(),
    onStatus: broadcastFiles
  })
  registerFilesIpc(files)
  app.on('before-quit', () => {
    void sync.stop()
    void files.stop()
    void activity.stop()
    void presence.stop()
  })

  const win = createMenubarWindow()
  optimizer.watchWindowShortcuts(win)
  const { tray, show, setPinned, unpinAndReset } = createTray(win, showConsultora)
  registerUiIpc(setPinned, () => {
    unpinAndReset()
    resetConsultoraBounds()
    win.webContents.reload()
  })

  // Workspace: bóveda en disco + índice. Se sincroniza al arrancar y vigila cambios de Finder o Claude.
  const workspace = new WorkspaceService(db, new Vault(config.workspacePath), notify)
  const watcher = new WorkspaceWatcher(workspace)
  await watcher.ensure().catch(() => undefined)
  serveVault(workspace)

  const tasks = new TaskService(db)
  const notes = new NoteService(db, workspace)
  // Una sola vez: las notas de la tabla vieja pasan a «Notas rápidas» en la bóveda.
  await moveNotesToVault(db, workspace).catch((error) =>
    console.error('[workspace] migrar notas', error)
  )
  // Mientras graba, el menubar muestra «● REC».
  const consultora = createConsultora(db, notify, (recording) =>
    tray.setTitle(recording ? ' ● REC' : '')
  )
  await consultora.recordings.recoverInterrupted()

  // Notas de voz: atajo global → pastilla → transcribir → nota en markdown. Clic en el aviso abre la nota.
  const openNote = (note: Note): void => {
    show()
    win.webContents.send('notes:open', note)
  }
  const voiceNotes = new VoiceNoteService(dataDir, notes, consultora.ai, (note) => {
    notify()
    notifyNoteCreated(note, noteTitle(note.body), openNote)
  })
  const voice = new VoiceController(voiceNotes)
  await voice.refresh()
  app.on('will-quit', disposeVoiceShortcut)

  registerIpc(tasks, notes, (sender) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (w.webContents.id !== sender.id) w.webContents.send('data:changed')
    }
    sync.poke()
  })
  registerWorkspaceIpc(workspace, watcher, notify)
  // ⌥⌘W (configurable): abre el workspace desde cualquier app.
  const workspaceShortcut = new WorkspaceShortcut()
  workspaceShortcut.refresh()
  app.on('will-quit', () => workspaceShortcut.dispose())
  registerConsultoraIpc(consultora, notify, voice, workspaceShortcut)
  // Email marketing: la cola hacia Resend (y el hub) se sincroniza sola cada minuto y al despertar.
  const marketing = createMarketing(db, resendFromConfig, hubFromConfig, notify)
  registerMarketingIpc(marketing, notify)
  marketing.sync.start()
  powerMonitor.on('resume', () => void marketing.sync.tick())
  const automations = new AutomationEngine(db, {
    handlers: createHandlers(notes),
    ports: createPorts(),
    onRunChange: runsChangedBroadcaster(),
    onAlert: (_id, message) => macNotifier.notify('Automatización', message)
  })
  const automationDeps = {
    db,
    kick: () => automations.kick(),
    invalidate: () => automations.cache.invalidate(),
    userId: () => account?.userId() ?? null
  }
  registerAutomationsIpc(new AutomationService({ ...automationDeps, origin: () => 'user' }), notify)
  void automations.start().catch((error) => console.error('[automations]', error))
  powerMonitor.on('resume', () => automations.kick())
  app.on('before-quit', () => automations.stop())
  allowScreenCapture()
  ipcMain.on('window:hide', () => win.hide())
  ipcMain.on('window:openConsultora', (_e, target?: { client?: string; workspace?: boolean }) => {
    win.hide()
    if (target?.client || target?.workspace) openConsultoraAt(target)
    else showConsultora()
  })
  app.on('second-instance', show)

  // En desarrollo, abrir la ventana al arrancar para iterar más rápido.
  if (!app.isPackaged) win.once('ready-to-show', show)

  // Claude cambió algo: las ventanas recargan lo que estén mostrando.
  await startServer(
    {
      tasks,
      notes,
      consultora,
      marketing,
      workspace,
      automations: new AutomationService({ ...automationDeps, origin: () => 'claude' })
    },
    dataDir,
    notify
  )
  await sync.refresh().catch((error) => console.error('[sincronización]', error))
  await files.refresh().catch((error) => console.error('[archivos]', error))
  await activity.refresh().catch((error) => console.error('[actividad]', error))
  await presence.refresh().catch((error) => console.error('[presencia]', error))
}

function serveVault(workspace: WorkspaceService): void {
  protocol.handle('vault', async (request) => {
    if (!fromApp(request, process.env['ELECTRON_RENDERER_URL']))
      return new Response('Prohibido', { status: 403 })
    try {
      const url = new URL(request.url)
      const rel = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      const abs =
        url.hostname === 'item' ? await workspace.absPath(rel) : await workspace.absOf(rel)
      return net.fetch(pathToFileURL(abs).toString())
    } catch {
      return new Response('No encontrado', { status: 404 })
    }
  })
}

// La app vive en el menubar: cerrar la ventana no la termina.
app.on('window-all-closed', () => {})
