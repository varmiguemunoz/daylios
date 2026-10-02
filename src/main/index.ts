import { app, BrowserWindow, ipcMain } from 'electron'
import { optimizer } from '@electron-toolkit/utils'
import { openDatabase } from './db/data-source'
import { loadConfig } from './config'
import { TaskService } from './services/task.service'
import { NoteService } from './services/note.service'
import { createConsultora } from './consultora'
import { registerIpc } from './ipc'
import { registerConsultoraIpc } from './ipc.consultora'
import { startServer } from './server'
import { createMenubarWindow, createTray } from './window'
import { allowScreenCapture, showConsultora } from './consultora-window'

// Audio del sistema al grabar pantalla en macOS (ScreenCaptureKit). Debe ir antes de `ready`.
app.commandLine.appendSwitch(
  'enable-features',
  'MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride'
)

// Una sola instancia: un segundo arranque abre la ventana existente.
if (!app.requestSingleInstanceLock()) app.quit()
else app.whenReady().then(start)

async function start(): Promise<void> {
  // App de menubar: sin icono en el Dock.
  // El arranque al iniciar sesión lo gestiona el servicio de launchd (scripts/install.sh).
  app.dock?.hide()

  const dataDir = app.getPath('userData')
  loadConfig(dataDir)
  const db = await openDatabase(dataDir)

  // Avisa a todas las ventanas de que algo cambió (Claude, grabación, otra ventana).
  const notify = (): void => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('data:changed')
  }

  const win = createMenubarWindow()
  optimizer.watchWindowShortcuts(win)
  const { tray, show } = createTray(win, showConsultora)

  const tasks = new TaskService(db)
  const notes = new NoteService(db)
  // Mientras graba, el menubar muestra «● REC».
  const consultora = createConsultora(db, notify, (recording) =>
    tray.setTitle(recording ? ' ● REC' : '')
  )
  await consultora.recordings.recoverInterrupted()

  registerIpc(tasks, notes)
  registerConsultoraIpc(consultora, notify)
  allowScreenCapture()
  ipcMain.on('window:hide', () => win.hide())
  ipcMain.on('window:openConsultora', () => {
    win.hide()
    showConsultora()
  })
  app.on('second-instance', show)

  // En desarrollo, abrir la ventana al arrancar para iterar más rápido.
  if (!app.isPackaged) win.once('ready-to-show', show)

  // Claude cambió algo: las ventanas recargan lo que estén mostrando.
  await startServer({ tasks, notes, consultora }, dataDir, notify)
}

// La app vive en el menubar: cerrar la ventana no la termina.
app.on('window-all-closed', () => {})
