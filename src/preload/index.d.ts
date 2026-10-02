import type { TasksApi } from '../shared/tasks'
import type { Note, NotesApi, VoiceResult } from '../shared/notes'
import type { ConsultoraApi, Meeting, StopInfo } from '../shared/consultora'

declare global {
  interface Window {
    api: {
      tasks: TasksApi
      notes: NotesApi
      consultora: ConsultoraApi
      recording: {
        start: () => Promise<Meeting>
        chunk: (id: string, data: Uint8Array) => Promise<void>
        stop: (id: string, info: StopInfo) => Promise<Meeting>
      }
      permissions: {
        check: () => Promise<{ screen: string; microphone: string; accessibility: boolean }>
        open: (kind: 'screen' | 'microphone' | 'accessibility') => Promise<void>
        restartApp: () => Promise<void>
      }
      voice: {
        onStart: (cb: () => void) => () => void
        onStop: (cb: () => void) => () => void
        finish: (data: Uint8Array, seconds: number) => Promise<VoiceResult>
        hide: () => void
      }
      /** Clic en «Nota creada»: el popover abre esa nota. */
      onNotesOpen: (cb: (note: Note) => void) => () => void
      hideWindow: () => void
      /** Abre la ventana Consultora (y oculta el popover). */
      openConsultora: () => void
      /** Abre un archivo o carpeta en Finder (solo dentro de tu carpeta personal). */
      openPath: (path: string) => Promise<void>
      /** Ruta en disco de un archivo soltado en la ventana. */
      pathForFile: (file: File) => string
      /** La ventana del menubar se acaba de mostrar. */
      onWindowShown: (cb: () => void) => () => void
      /** Claude, una grabación u otra ventana cambiaron datos. */
      onDataChanged: (cb: () => void) => () => void
    }
  }
}
