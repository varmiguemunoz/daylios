import { watch, type FSWatcher } from 'fs'
import type { WorkspaceService } from './workspace.service'

const DEBOUNCE_MS = 300

export class WorkspaceWatcher {
  private watcher: FSWatcher | null = null
  private watching = ''
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly workspace: WorkspaceService) {}

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
