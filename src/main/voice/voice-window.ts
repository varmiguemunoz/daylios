import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const WIDTH = 280
const HEIGHT = 64

/**
 * Pastilla flotante de la nota de voz: transparente, siempre encima, sin robar el foco,
 * visible en todos los escritorios y sobre apps a pantalla completa.
 * También es la que graba el micrófono (una ventana oculta no puede mostrar nada, pero sí grabar).
 */
export function createVoiceWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?window=voice`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { window: 'voice' } })
  }
  return win
}

/** Muestra la pastilla arriba al centro de la pantalla donde está el ratón, sin darle el foco. */
export function showVoiceWindow(win: BrowserWindow): void {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  win.setBounds({
    x: Math.round(area.x + area.width / 2 - WIDTH / 2),
    y: area.y + 10,
    width: WIDTH,
    height: HEIGHT
  })
  win.showInactive()
}
