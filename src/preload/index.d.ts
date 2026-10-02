import type { TasksApi } from '../shared/tasks'
import type { NotesApi } from '../shared/notes'
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
      hideWindow: () => void
      /** Abre la ventana Consultora (y oculta el popover). */
      openConsultora: () => void
      /** Abre un archivo o carpeta en Finder (solo dentro de tu carpeta personal). */
      openPath: (path: string) => Promise<void>
      /** La ventana del menubar se acaba de mostrar. */
      onWindowShown: (cb: () => void) => () => void
      /** Claude, una grabación u otra ventana cambiaron datos. */
      onDataChanged: (cb: () => void) => () => void
    }
  }
}
