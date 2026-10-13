import { app, BrowserWindow, ipcMain, net, powerMonitor, protocol, shell } from 'electron'
import { pathToFileURL } from 'url'
import { optimizer } from '@electron-toolkit/utils'
import { openDatabase } from './db/data-source'
import { config, loadConfig } from './config'
import { TaskService } from './services/task.service'
import { NoteService } from './services/note.service'
import { moveNotesToVault } from './services/notes-to-vault'
import { createConsultora } from './consultora'
import { registerIpc } from './ipc'
import { registerConsultoraIpc } from './ipc.consultora'
import { createMarketing } from './marketing'
import { registerMarketingIpc } from './ipc.marketing'
import { resendFromConfig } from './services/resend.provider'
import { hubFromConfig } from './services/hub.client'
import { startServer } from './server'
import { createMenubarWindow, createTray } from './window'
import { allowScreenCapture, openConsultoraAt, showConsultora } from './consultora-window'
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

// Una sola instancia: un segundo arranque abre la ventana existente.
if (!app.requestSingleInstanceLock()) app.quit()
else app.whenReady().then(start)

async function start(): Promise<void> {
  // App de menubar: sin icono en el Dock.
  // El arranque al iniciar sesión lo gestiona el servicio de launchd (scripts/install.sh).
  app.dock?.hide()

  const dataDir = app.getPath('userData')
  loadConfig(dataDir)
  setTrash((path) => shell.trashItem(path))
  const db = await openDatabase(dataDir)

  // Avisa a todas las ventanas de que algo cambió (Claude, grabación, otra ventana).
  const notify = (): void => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('data:changed')
  }

  const win = createMenubarWindow()
  optimizer.watchWindowShortcuts(win)
  const { tray, show } = createTray(win, showConsultora)

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

  registerIpc(tasks, notes)
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
  await startServer({ tasks, notes, consultora, marketing, workspace }, dataDir, notify)
}

/** Sirve archivos de la bóveda a las ventanas. Toda ruta pasa por la validación del vault. */
function serveVault(workspace: WorkspaceService): void {
  protocol.handle('vault', async (request) => {
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
