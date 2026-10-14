import { BrowserWindow, Menu, Tray, nativeImage, screen, shell, type Rectangle } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import trayIcon from '../../resources/trayTemplate.png?asset'
import { MENUBAR_WINDOW_KEY, type MenubarWindowState } from '@shared/ui-state'
import { uiState } from './services/ui-state'

const WIDTH = 400
const HEIGHT = 760
const MIN_HEIGHT = 480
const MAX_HEIGHT = 1000

const pinState = (): MenubarWindowState =>
  uiState().get<MenubarWindowState>(MENUBAR_WINDOW_KEY) ?? { pinned: false }

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

  // Se cierra al perder el foco, como un popover nativo. Fijada se queda, como una ventana.
  win.on('blur', () => {
    if (!pinState().pinned && !win.webContents.isDevToolsOpened()) win.hide()
  })

  // Fijada: se recuerda dónde la dejaste y su alto.
  let moved: NodeJS.Timeout | null = null
  const remember = (): void => {
    if (!pinState().pinned) return
    if (moved) clearTimeout(moved)
    moved = setTimeout(() => {
      const b = win.getBounds()
      uiState().patch({
        [MENUBAR_WINDOW_KEY]: { pinned: true, x: b.x, y: b.y, height: b.height }
      })
    }, 300)
  }
  win.on('moved', remember)
  win.on('resized', remember)
  applyPinned(win, pinState().pinned)

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

function applyPinned(win: BrowserWindow, pinned: boolean): void {
  win.setMovable(pinned)
  win.setResizable(pinned)
  win.setMinimumSize(WIDTH, pinned ? MIN_HEIGHT : 0)
  win.setMaximumSize(WIDTH, pinned ? MAX_HEIGHT : 10000)
}

export function onSomeDisplay(r: Rectangle): boolean {
  return screen.getAllDisplays().some(({ workArea: a }) => {
    const visibleWidth = Math.min(r.x + r.width, a.x + a.width) - Math.max(r.x, a.x)
    const topInside = r.y >= a.y && r.y <= a.y + a.height - 40
    return visibleWidth >= 80 && topInside
  })
}

export function createTray(
  win: BrowserWindow,
  openConsultora: () => void
): {
  tray: Tray
  show: () => void
  setPinned: (pinned: boolean) => MenubarWindowState
  unpinAndReset: () => void
} {
  const image = nativeImage.createFromPath(trayIcon)
  image.setTemplateImage(true)
  const tray = new Tray(image)
  tray.setToolTip('DayliOS')

  const show = (): void => {
    const state = pinState()
    const saved =
      state.pinned && state.x !== undefined && state.y !== undefined
        ? { x: state.x, y: state.y, width: WIDTH, height: state.height ?? HEIGHT }
        : null
    if (saved && onSomeDisplay(saved)) win.setBounds(saved, false)
    else placeUnder(win, tray)
    win.show()
    win.focus()
    win.webContents.send('window:shown')
  }

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir DayliOS', click: show },
    { label: 'Abrir Consultora', click: openConsultora },
    { type: 'separator' },
    { label: 'Salir', role: 'quit' }
  ])

  tray.on('click', () => (win.isVisible() ? win.hide() : show()))
  tray.on('right-click', () => tray.popUpContextMenu(menu))

  const setPinned = (pinned: boolean): MenubarWindowState => {
    const b = win.getBounds()
    const state: MenubarWindowState = pinned
      ? { pinned: true, x: b.x, y: b.y, height: b.height }
      : { pinned: false }
    uiState().patch({ [MENUBAR_WINDOW_KEY]: state })
    applyPinned(win, pinned)
    if (!pinned && win.isVisible()) placeUnder(win, tray)
    return state
  }

  const unpinAndReset = (): void => {
    applyPinned(win, false)
    if (win.isVisible()) placeUnder(win, tray)
  }

  return { tray, show, setPinned, unpinAndReset }
}

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
