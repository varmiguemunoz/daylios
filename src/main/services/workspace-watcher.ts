import { watch, type FSWatcher } from 'fs'
import type { WorkspaceService } from './workspace.service'

const DEBOUNCE_MS = 300

/**
 * Vigila la bóveda (FSEvents en macOS, recursivo) y sincroniza el índice cuando algo cambia fuera:
 * Finder, otro editor o Claude escribiendo archivos. Los cambios de la propia app no avisan dos veces:
 * cuando llega el evento, el índice ya coincide y `sync()` no encuentra nada.
 * Si cambia la carpeta en Ajustes, `ensure()` vuelve a vigilar la nueva.
 */
export class WorkspaceWatcher {
  private watcher: FSWatcher | null = null
  private watching = ''
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly workspace: WorkspaceService) {}

  /** Empieza (o reanuda en otra carpeta) y hace un sync completo. */
  async ensure(): Promise<void> {
    const root = this.workspace.vault.root()
    if (this.watcher && this.watching === root) return
    this.stop()
    await this.workspace.vault.ensure()
    this.watching = root
    try {
      this.watcher = watch(root, { recursive: true }, () => this.schedule())
      this.watcher.on('error', () => this.stop())
    } catch {
      this.watcher = null // sin vigilante: la UI sigue funcionando y sincroniza al abrir
    }
    await this.workspace.sync()
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
    this.watching = ''
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.workspace.sync().catch(() => undefined)
    }, DEBOUNCE_MS)
  }
}
