import { BrowserWindow, Menu, Tray, nativeImage, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import trayIcon from '../../resources/trayTemplate.png?asset'

const WIDTH = 400
const HEIGHT = 760

/** Ventana tipo popover anclada al icono del menubar. */
export function createMenubarWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    backgroundColor: '#131313',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Visible también sobre apps en pantalla completa.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Se cierra al perder el foco, como un popover nativo.
  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) win.hide()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/** Icono del menubar: clic abre/cierra, clic derecho muestra el menú. */
export function createTray(win: BrowserWindow): { tray: Tray; show: () => void } {
  const image = nativeImage.createFromPath(trayIcon)
  image.setTemplateImage(true)
  const tray = new Tray(image)
  tray.setToolTip('DayliOS')

  const show = (): void => {
    placeUnder(win, tray)
    win.show()
    win.focus()
    win.webContents.send('window:shown')
  }

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir DayliOS', click: show },
    { type: 'separator' },
    { label: 'Salir', role: 'quit' }
  ])

  tray.on('click', () => (win.isVisible() ? win.hide() : show()))
  tray.on('right-click', () => tray.popUpContextMenu(menu))

  return { tray, show }
}

/** Centra la ventana bajo el icono, sin salirse de la pantalla. */
function placeUnder(win: BrowserWindow, tray: Tray): void {
  const icon = tray.getBounds()
  const area = screen.getDisplayNearestPoint({ x: icon.x, y: icon.y }).workArea
  const x = Math.round(icon.x + icon.width / 2 - WIDTH / 2)
  const y = Math.max(Math.round(icon.y + icon.height + 6), area.y + 6)
  win.setBounds(
    {
      x: Math.min(Math.max(x, area.x + 8), area.x + area.width - WIDTH - 8),
      y,
      width: WIDTH,
      // En pantallas bajas, encoger (el contenido hace scroll).
      height: Math.min(HEIGHT, area.y + area.height - y - 8)
    },
    false
  )
}
