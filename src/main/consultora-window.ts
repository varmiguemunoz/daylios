import { app, BrowserWindow, desktopCapturer, session, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { CONSULTORA_WINDOW_KEY, type WindowBoundsState } from '@shared/ui-state'
import { uiState } from './services/ui-state'
import { onSomeDisplay } from './window'

const SIZE = { width: 1100, height: 760 }

let win: BrowserWindow | null = null
let quitting = false
app.on('before-quit', () => (quitting = true))

export function showConsultora(): BrowserWindow {
  if (win) {
    win.show()
    win.focus()
    return win
  }

  // Vuelve donde la dejaste; si esa pantalla ya no está, centrada en la principal.
  const saved = uiState().get<WindowBoundsState>(CONSULTORA_WINDOW_KEY)
  const bounds = saved && onSomeDisplay(saved) ? saved : null

  win = new BrowserWindow({
    ...(bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : SIZE),
    minWidth: 860,
    minHeight: 560,
    show: false,
    title: 'Consultora · DayliOS',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#131313',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const current = win
  let timer: NodeJS.Timeout | null = null
  const remember = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (current.isDestroyed()) return
      const b = current.getNormalBounds()
      uiState().patch({
        [CONSULTORA_WINDOW_KEY]: {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          maximized: current.isMaximized(),
          fullscreen: current.isFullScreen()
        } satisfies WindowBoundsState
      })
    }, 300)
  }
  win.on('moved', remember)
  win.on('resized', remember)
  win.on('maximize', remember)
  win.on('unmaximize', remember)
  win.on('enter-full-screen', remember)
  win.on('leave-full-screen', remember)

  win.on('close', (event) => {
    remember()
    if (quitting) return
    event.preventDefault()
    win?.hide()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?window=consultora`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { window: 'consultora' } })
  }

  win.once('ready-to-show', () => {
    if (bounds?.fullscreen) win?.setFullScreen(true)
    else if (bounds?.maximized) win?.maximize()
    win?.show()
  })
  return win
}

export function resetConsultoraBounds(): void {
  if (!win) return
  if (win.isFullScreen()) win.setFullScreen(false)
  if (win.isMaximized()) win.unmaximize()
  win.setSize(SIZE.width, SIZE.height)
  win.center()
}

export const consultoraWindow = (): BrowserWindow | null => win

export function openConsultoraAt(target: {
  client?: string
  workspace?: boolean
  account?: boolean
  open?: { entity: string; id: string }
}): BrowserWindow {
  const w = showConsultora()
  const send = (): void => w.webContents.send('consultora:navigate', target)
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send)
  else send()
  return w
}

export function allowScreenCapture(): void {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const [screen] = await desktopCapturer.getSources({ types: ['screen'] })
      callback(screen ? { video: screen, audio: 'loopback' } : {})
    } catch {
      callback({}) // getDisplayMedia rechaza al momento y la ventana muestra cómo dar el permiso
    }
  })
}
