import { BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { config } from './config'
import { consultoraWindow, openConsultoraAt } from './consultora-window'

/**
 * Atajo global del workspace (por defecto ⌥⌘W): desde cualquier app abre Consultora en el workspace;
 * si el workspace ya está delante, oculta la ventana. La ventana avisa si está en el workspace.
 */
export class WorkspaceShortcut {
  private current = ''
  private registered = false
  private active = false

  constructor() {
    ipcMain.on('workspace:active', (event, on: boolean) => {
      if (BrowserWindow.fromWebContents(event.sender) === consultoraWindow()) this.active = Boolean(on)
    })
  }

  /** (Re)registra el atajo de Ajustes. Vacío = ninguno. */
  refresh(): { shortcut: string; registered: boolean } {
    const wanted = config.workspaceShortcut()
    if (wanted !== this.current) {
      if (this.current && this.registered) globalShortcut.unregister(this.current)
      this.current = wanted
      this.registered = false
      if (wanted) {
        try {
          this.registered = globalShortcut.register(wanted, () => this.toggle())
        } catch {
          this.registered = false // acelerador inválido
        }
      }
    }
    return this.status()
  }

  status(): { shortcut: string; registered: boolean } {
    return { shortcut: this.current, registered: this.registered }
  }

  dispose(): void {
    if (this.current && this.registered) globalShortcut.unregister(this.current)
    this.registered = false
  }

  private toggle(): void {
    const win = consultoraWindow()
    if (win && win.isVisible() && win.isFocused() && this.active) {
      win.hide()
      return
    }
    openConsultoraAt({ workspace: true })
  }
}
