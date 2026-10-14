import { ipcMain } from 'electron'
import { editionStatus } from './edition'

export function registerEditionIpc(): void {
  ipcMain.handle('edition:status', () => editionStatus())
}
