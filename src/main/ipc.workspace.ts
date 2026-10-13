import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { WorkspaceService } from './services/workspace.service'
import type { WorkspaceWatcher } from './services/workspace-watcher'

/**
 * IPC `workspace:<método>` (contrato `WorkspaceApi`). Las escrituras avisan a las ventanas.
 * Diálogo, Finder y «abrir con» viven aquí porque son de Electron, no del servicio.
 */
export function registerWorkspaceIpc(
  w: WorkspaceService,
  watcher: WorkspaceWatcher,
  notify: () => void
): void {
  const read = (channel: string, fn: (...args: never[]) => unknown): void => {
    ipcMain.handle(`workspace:${channel}`, (_e, ...args) => fn(...(args as never[])))
  }
  const write = (channel: string, fn: (...args: never[]) => Promise<unknown>): void => {
    ipcMain.handle(`workspace:${channel}`, async (_e, ...args) => {
      const result = await fn(...(args as never[]))
      notify()
      return result
    })
  }

  // Abrir el workspace arranca el vigilante (o lo cambia de carpeta si cambió en Ajustes).
  read('info', async () => {
    await watcher.ensure()
    return w.info()
  })
  read('tree', () => w.tree())
  read('explorer', () => w.explorer())
  read('list', (folderId: string | null) => w.list(folderId))
  read('get', (id: string) => w.get(id))
  read('resolve', (ref: string) => w.resolve(ref))
  read('search', (q: string) => w.search(q))
  read('impact', (id: string) => w.impact(id))
  write('createFolder', (parentId: string | null, name: string) => w.createFolder(parentId, name))
  write('createNote', (folderId: string | null, name?: string, body?: string) =>
    w.createNote(folderId, name, body)
  )
  write('createBoard', (folderId: string | null, name?: string) => w.createBoard(folderId, name))
  write('rename', (id: string, name: string) => w.rename(id, name))
  write('move', (id: string, folderId: string | null) => w.move(id, folderId))
  write('remove', (id: string) => w.remove(id))
  write('upload', (folderId: string | null, paths: string[]) => w.upload(folderId, paths))
  write('attach', (noteId: string, name: string, data: Uint8Array) => w.attach(noteId, name, data))
  read('readBoard', (id: string) => w.readBoard(id))
  // Sin aviso: el board abierto es quien escribe; avisar recargaría las demás ventanas en cada cambio.
  read('writeBoard', (id: string, json: string, expected?: string) =>
    w.writeBoard(id, json, expected)
  )

  ipcMain.handle('workspace:pickFiles', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = { properties: ['openFile', 'multiSelections'] }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? [] : result.filePaths
  })
  ipcMain.handle('workspace:reveal', async (_e, id: string) =>
    shell.showItemInFolder(await w.absPath(id))
  )
  ipcMain.handle('workspace:openExternal', async (_e, id: string) => {
    const error = await shell.openPath(await w.absPath(id))
    if (error) throw new Error(error)
  })
}
