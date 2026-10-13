import type { TasksApi } from '../shared/tasks'
import type { Note, NotesApi, VoiceResult } from '../shared/notes'
import type { ConsultoraApi, Meeting, StopInfo } from '../shared/consultora'
import type { MarketingApi } from '../shared/marketing'
import type { WorkspaceApi } from '../shared/workspace'

declare global {
  interface Window {
    api: {
      tasks: TasksApi
      notes: NotesApi
      workspace: WorkspaceApi
      consultora: ConsultoraApi
      marketing: MarketingApi
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
      /** Consultora avisa si el workspace está delante (el atajo global lo usa para ocultar). */
      setWorkspaceActive: (on: boolean) => void
      /** Abre la ventana Consultora (y oculta el popover). Con `client`, en la ficha de ese cliente. */
      openConsultora: (target?: { client?: string; workspace?: boolean }) => void
      /** Consultora: main pide abrir una pantalla (p. ej. un cliente desde una nota del menubar). */
      onConsultoraNavigate: (cb: (target: { client?: string; workspace?: boolean }) => void) => () => void
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
