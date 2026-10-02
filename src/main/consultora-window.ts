import { app, BrowserWindow, desktopCapturer, session, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let win: BrowserWindow | null = null
let quitting = false
app.on('before-quit', () => (quitting = true))

/**
 * Ventana grande «Consultora». Se crea la primera vez y luego solo se muestra/oculta:
 * cerrarla la oculta, así una grabación en curso no se corta.
 */
export function showConsultora(): BrowserWindow {
  if (win) {
    win.show()
    win.focus()
    return win
  }

  win = new BrowserWindow({
    width: 1100,
    height: 760,
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

  win.on('close', (event) => {
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

  win.once('ready-to-show', () => win?.show())
  return win
}

/**
 * Captura de pantalla para grabar reuniones: pantalla principal + audio del sistema
 * ('loopback', ScreenCaptureKit, macOS 13+). Sin selector: graba la pantalla principal.
 */
export function allowScreenCapture(): void {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const [screen] = await desktopCapturer.getSources({ types: ['screen'] })
    callback(screen ? { video: screen, audio: 'loopback' } : {})
  })
}
