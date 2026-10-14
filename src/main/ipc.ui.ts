import { ipcMain } from 'electron'
import type { MenubarWindowState, UiPatch } from '@shared/ui-state'
import { uiState } from './services/ui-state'

const asPatch = (value: unknown): UiPatch | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UiPatch) : null

export function registerUiIpc(
  setMenubarPinned: (pinned: boolean) => MenubarWindowState,
  onReset: () => void
): void {
  ipcMain.handle('ui:load', () => uiState().all())
  ipcMain.on('ui:patch', (_e, changes: unknown) => {
    const patch = asPatch(changes)
    if (patch) uiState().patch(patch)
  })
  ipcMain.handle('ui:reset', () => {
    uiState().reset()
    onReset()
  })
  ipcMain.handle('ui:menubarPin', (_e, pinned: unknown) => setMenubarPinned(pinned === true))
}
