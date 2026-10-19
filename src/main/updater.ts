import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '@shared/app'

const EVERY = 6 * 60 * 60 * 1000

export interface UpdaterDeps {
  enabled: boolean
  disabledReason?: 'unpackaged' | 'local-build'
  onState: (state: UpdateState) => void
  onReady: (version: string) => void
}

export class Updater {
  private state: UpdateState

  constructor(private readonly deps: UpdaterDeps) {
    this.state = deps.enabled
      ? { status: 'idle' }
      : { status: 'disabled', reason: deps.disabledReason ?? 'unpackaged' }
  }

  current(): UpdateState {
    return this.state
  }

  start(): void {
    if (!this.deps.enabled) return
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () => this.set({ status: 'checking' }))
    autoUpdater.on('update-not-available', () => this.set({ status: 'none' }))
    autoUpdater.on('update-available', (info) =>
      this.set({ status: 'downloading', version: info.version, percent: 0 })
    )
    autoUpdater.on('download-progress', (progress) => {
      if (this.state.status === 'downloading')
        this.set({ ...this.state, percent: Math.round(progress.percent) })
    })
    autoUpdater.on('update-downloaded', (info) => {
      this.set({ status: 'ready', version: info.version })
      this.deps.onReady(info.version)
    })
    autoUpdater.on('error', (error) => this.set({ status: 'error', message: error.message }))
    void this.check()
    setInterval(() => void this.check(), EVERY).unref()
  }

  async check(): Promise<UpdateState> {
    if (!this.deps.enabled || this.state.status === 'downloading' || this.state.status === 'ready')
      return this.state
    await autoUpdater
      .checkForUpdates()
      .catch((error: Error) => this.set({ status: 'error', message: error.message }))
    return this.state
  }

  install(): void {
    if (this.state.status === 'ready') autoUpdater.quitAndInstall()
  }

  private set(state: UpdateState): void {
    this.state = state
    this.deps.onState(state)
  }
}
