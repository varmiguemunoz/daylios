import { app, ipcMain } from 'electron'
import { optimizer } from '@electron-toolkit/utils'
import { openDatabase } from './db/data-source'
import { TaskService } from './services/task.service'
import { registerIpc } from './ipc'
import { startServer } from './server'
import { createMenubarWindow, createTray } from './window'

// Una sola instancia: un segundo arranque abre la ventana existente.
if (!app.requestSingleInstanceLock()) app.quit()
else app.whenReady().then(start)

async function start(): Promise<void> {
  // App de menubar: sin icono en el Dock.
  // El arranque al iniciar sesión lo gestiona el servicio de launchd (scripts/install.sh).
  app.dock?.hide()

  const dataDir = app.getPath('userData')
  const service = new TaskService(await openDatabase(dataDir))

  const win = createMenubarWindow()
  optimizer.watchWindowShortcuts(win)
  const { show } = createTray(win)

  registerIpc(service)
  ipcMain.on('window:hide', () => win.hide())
  app.on('second-instance', show)

  // En desarrollo, abrir la ventana al arrancar para iterar más rápido.
  if (!app.isPackaged) win.once('ready-to-show', show)

  await startServer(service, dataDir, () => win.webContents.send('tasks:changed'))
}

// La app vive en el menubar: cerrar la ventana no la termina.
app.on('window-all-closed', () => {})
