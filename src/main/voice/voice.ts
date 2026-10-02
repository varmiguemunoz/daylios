import { ipcMain, Notification, systemPreferences, type BrowserWindow } from 'electron'
import type { Note } from '@shared/notes'
import type { VoiceStatus } from '@shared/consultora'
import { config } from '../config'
import type { VoiceNoteService } from '../services/voice-note.service'
import { createVoiceWindow, showVoiceWindow } from './voice-window'
import { registerVoiceShortcut, unregisterVoiceShortcut, type ShortcutState } from './shortcut'

/**
 * Nota de voz de principio a fin:
 * atajo pulsado → pastilla visible + `voice:start` (la pastilla graba el micro)
 * atajo soltado → `voice:stop` → la pastilla manda el audio con `voice:finish` → VoiceNoteService.
 */
export class VoiceController {
  private readonly win: BrowserWindow
  private state: ShortcutState = { registered: false, mode: 'toggle' }

  constructor(private readonly service: VoiceNoteService) {
    this.win = createVoiceWindow()

    ipcMain.handle('voice:finish', (_e, data: Uint8Array, seconds: number) => this.service.finish(data, seconds))
    ipcMain.on('voice:hide', () => this.win.hide())
  }

  /** (Re)registra el atajo con los ajustes actuales. Llamar al arrancar y al cambiar Ajustes. */
  async refresh(): Promise<VoiceStatus> {
    if (config.voiceEnabled()) {
      this.state = await registerVoiceShortcut(config.voiceShortcut(), {
        start: () => {
          showVoiceWindow(this.win)
          this.win.webContents.send('voice:start')
        },
        stop: () => this.win.webContents.send('voice:stop')
      })
    } else {
      unregisterVoiceShortcut()
      this.state = { registered: false, mode: 'toggle' }
    }
    return this.status()
  }

  async status(): Promise<VoiceStatus> {
    return {
      shortcut: config.voiceShortcut(),
      enabled: config.voiceEnabled(),
      registered: this.state.registered,
      mode: this.state.mode,
      accessibility: systemPreferences.isTrustedAccessibilityClient(false),
      pending: await this.service.pending()
    }
  }

  retry(): Promise<{ created: number; failed: number }> {
    return this.service.retry()
  }
}

/** Notificación «Nota creada»; clic abre la nota en el popover. */
export function notifyNoteCreated(note: Note, title: string, open: (note: Note) => void): void {
  const notification = new Notification({ title: 'Nota creada', body: title })
  notification.on('click', () => open(note))
  notification.show()
}
