import { randomUUID } from 'crypto'
import { stat } from 'fs/promises'
import { basename } from 'path'
import { In, IsNull, type DataSource, type EntityManager, type Repository } from 'typeorm'
import { normalizeName } from '@shared/consultora'
import { NOTE_MAX, setNoteTitle } from '@shared/notes'
import {
  ATTACHMENTS,
  CONFLICT_MESSAGE,
  MAX_UPLOAD,
  PREVIEW_MAX_BYTES,
  QUICK_NOTES,
  baseName,
  dirName,
  displayName,
  extOf,
  joinPath,
  normalizePath,
  relativePath,
  type BoardContent,
  type Crumb,
  type DeleteImpact,
  type ExplorerTree,
  type FolderListing,
  type FileBytes,
  type FolderNode,
  type SearchHit,
  type WorkspaceInfo,
  type WorkspaceItem
} from '@shared/workspace'
import {
  EMPTY_CANVAS,
  applyBoardOps,
  canvasFileRefs,
  parseCanvas,
  rewriteCanvasFiles,
  serializeCanvas,
  summarizeCanvas,
  type BoardOp
} from '@shared/canvas'
import { noteRefs, rewriteMarkdownLinks } from '@shared/vault-links'
import {
  WorkspaceItemModel,
  WorkspaceRefModel,
  type WorkspaceRef,
  type WorkspaceRow
} from '../models/workspace.model'
import { NoteRelationModel } from '../models/note-relation.model'
import { transactionGuard } from '../guards/transaction.guard'
import { AppError } from './app.error'
import { safeName, type DiskEntry, type Vault } from './vault'

const iso = (ms: number): string => new Date(ms).toISOString()

export function toItem(r: WorkspaceRow): WorkspaceItem {
  return {
    id: r.id,
    kind: r.kind,
    path: r.path,
    name: r.name,
    parentId: r.parentId,
    size: r.size,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }
}

export class WorkspaceService {
  private chain: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly db: DataSource,
    readonly vault: Vault,
    private readonly onChange: () => void = () => undefined
  ) {}

  // ---------------------------------------------------------------- lecturas

  async info(): Promise<WorkspaceInfo> {
    const quick = await this.quickNotesFolder()
    return { root: this.vault.root(), quickNotesId: quick.id }
  }

  async tree(): Promise<FolderNode[]> {
    return (await this.buildTree(false)).folders
  }

  explorer(): Promise<ExplorerTree> {
    return this.buildTree(true)
  }

  private async buildTree(withItems: boolean): Promise<ExplorerTree> {
    const rows = await this.rows().find({ order: { path: 'ASC' } })
    const nodes = new Map<string, FolderNode>()
    const roots: FolderNode[] = []
    const rootFiles: WorkspaceItem[] = []
    for (const r of rows.filter((x) => x.kind === 'folder')) {
      nodes.set(r.id, {
        id: r.id,
        name: r.name,
        path: r.path,
        children: [],
        files: 0,
        ...(withItems ? { items: [] } : {})
      })
    }
    for (const r of rows) {
      if (r.kind === 'folder') {
        const node = nodes.get(r.id)!
        const parent = r.parentId ? nodes.get(r.parentId) : undefined
        if (parent) parent.children.push(node)
        else roots.push(node)
      } else {
        const parent = r.parentId ? nodes.get(r.parentId) : undefined
        if (parent) {
          parent.files++
          if (withItems) parent.items!.push(toItem(r))
        } else if (withItems && !r.parentId) rootFiles.push(toItem(r))
      }
    }
    const byName = (a: { name: string }, b: { name: string }): number =>
      a.name.localeCompare(b.name, 'es')
    const sort = (list: FolderNode[]): FolderNode[] => {
      list.sort(byName)
      for (const n of list) {
        sort(n.children)
        n.items?.sort(byName)
      }
      return list
    }
    return { folders: sort(roots), files: rootFiles.sort(byName) }
  }

  async list(folderId: string | null): Promise<FolderListing> {
    const folder = folderId ? await this.folderOrFail(folderId) : null
    const children = await this.rows().find({ where: { parentId: folder ? folder.id : IsNull() } })
    return {
      folder: folder ? toItem(folder) : null,
      crumbs: await this.crumbs(folder),
      items: children.map(toItem).sort(byKindThenName)
    }
  }

  async get(id: string): Promise<WorkspaceItem> {
    return toItem(await this.rowOrFail(id))
  }

  async resolve(ref: string): Promise<WorkspaceItem> {
    const value = String(ref ?? '').trim()
    const byId = value ? await this.rows().findOneBy({ id: value }) : null
    if (byId) return toItem(byId)
    const path = normalizePath(value)
    const byPath = path ? await this.rows().findOneBy({ path }) : null
    if (!byPath) throw new AppError('not_found', `No encuentro «${value}» en el workspace.`)
    return toItem(byPath)
  }

  async resolveFolder(ref: string | null | undefined): Promise<string | null> {
    const value = String(ref ?? '').trim()
    if (!value || value === 'root' || value === '/') return null
    const item = await this.resolve(value)
    if (item.kind !== 'folder') throw new AppError('invalid', `«${item.name}» no es una carpeta.`)
    return item.id
  }

  async content(
    id: string
  ): Promise<{ item: WorkspaceItem; text: string | null; modifiedAt: string }> {
    const row = await this.rowOrFail(id)
    const text =
      row.kind === 'note' || row.kind === 'board' ? await this.vault.readText(row.path) : null
    return { item: toItem(row), text, modifiedAt: iso(row.mtimeMs) }
  }

  async search(query: string): Promise<SearchHit[]> {
    const q = normalizeName(String(query ?? ''))
    if (q.length < 2) return []
    const rows = await this.rows().find({ order: { updatedAt: 'DESC' } })
    const hits: SearchHit[] = []
    for (const r of rows) {
      if (hits.length >= 50) break
      if (normalizeName(r.name).includes(q)) hits.push({ item: toItem(r), snippet: '' })
      else if (r.text) {
        const text = normalizeName(r.text)
        const at = text.indexOf(q)
        if (at >= 0) hits.push({ item: toItem(r), snippet: snippetAt(r.text, at, q.length) })
      }
    }
    return hits
  }

  async impact(id: string): Promise<DeleteImpact> {
    const row = await this.rowOrFail(id)
    const all = [row, ...(await this.descendants(row))]
    const ids = all.map((r) => r.id)
    const refs = await this.refs().find({ where: { toId: In(ids) } })
    const outside = new Set(refs.map((r) => r.fromId).filter((from) => !ids.includes(from)))
    const count = (kind: WorkspaceRow['kind']): number => all.filter((r) => r.kind === kind).length
    return {
      folders: count('folder'),
      notes: count('note'),
      boards: count('board'),
      files: count('image') + count('file'),
      referencedBy: outside.size
    }
  }

  async absPath(id: string): Promise<string> {
    return this.vault.safe((await this.rowOrFail(id)).path)
  }

  absOf(path: string): Promise<string> {
    return this.vault.safe(path)
  }

  // ---------------------------------------------------------------- escrituras

  sync(): Promise<boolean> {
    return this.exclusive(() => this.syncNow())
  }

  createFolder(parentId: string | null, name: string): Promise<WorkspaceItem> {
    return this.exclusive(async () => {
      const dir = await this.folderPath(parentId)
      const path = joinPath(dir, safeName(name))
      if (this.vault.exists(path))
        throw new AppError('invalid', `Ya existe «${baseName(path)}» ahí.`)
      await this.vault.mkdir(path)
      return this.afterWrite(path)
    })
  }

  createNote(folderId: string | null, name = 'Sin título', body = ''): Promise<WorkspaceItem> {
    return this.exclusive(async () => {
      const dir = await this.folderPath(folderId)
      const path = joinPath(dir, this.vault.uniqueName(dir, `${safeName(name)}.md`))
      await this.vault.writeText(path, body)
      return this.afterWrite(path)
    })
  }

  createBoard(folderId: string | null, name = 'Board sin título'): Promise<WorkspaceItem> {
    return this.exclusive(async () => {
      const dir = await this.folderPath(folderId)
      const path = joinPath(dir, this.vault.uniqueName(dir, `${safeName(name)}.canvas`))
      await this.vault.writeText(path, serializeCanvas(EMPTY_CANVAS))
      return this.afterWrite(path)
    })
  }

  rename(id: string, name: string): Promise<WorkspaceItem> {
    return this.exclusive(async () => {
      const row = await this.rowOrFail(id)
      const ext = row.kind === 'folder' ? '' : extOf(row.path)
      let file = safeName(name)
      if (ext && extOf(file) !== ext) file = `${file}${ext}`
      const path = joinPath(dirName(row.path), file)
      if (path === row.path) return toItem(row)
      const moved = await this.moveRow(row, path)
      // Una nota se llama como su título: renombrarla también cambia su primera línea.
      if (row.kind === 'note') {
        const text = await this.vault.readText(path)
        const titled = setNoteTitle(text, displayName(baseName(path), 'note'))
        if (titled !== text) {
          await this.vault.writeText(path, titled)
          return toItem(await this.refreshOne(path))
        }
      }
      return moved
    })
  }

  move(id: string, folderId: string | null): Promise<WorkspaceItem> {
    return this.exclusive(async () => {
      const row = await this.rowOrFail(id)
      const target = await this.folderPath(folderId)
      if (row.kind === 'folder' && (target === row.path || target.startsWith(`${row.path}/`))) {
        throw new AppError('invalid', 'Una carpeta no se puede mover dentro de sí misma.')
      }
      const path = joinPath(target, baseName(row.path))
      if (path === row.path) return toItem(row)
      return this.moveRow(row, path)
    })
  }

  remove(id: string): Promise<void> {
    return this.exclusive(async () => {
      const row = await this.rowOrFail(id)
      if (row.kind === 'folder' && row.parentId === null && row.name === QUICK_NOTES) {
        throw new AppError(
          'invalid',
          `«${QUICK_NOTES}» es donde caen las notas del menubar; no se puede borrar.`
        )
      }
      await this.vault.trash(row.path)
      await this.syncNow()
    })
  }

  upload(folderId: string | null, paths: string[]): Promise<WorkspaceItem[]> {
    return this.exclusive(async () => {
      if (!Array.isArray(paths) || !paths.length) return []
      const dir = await this.folderPath(folderId)
      const created: string[] = []
      for (const source of paths) {
        if (typeof source !== 'string') continue
        const info = await stat(source).catch(() => null)
        if (!info?.isFile())
          throw new AppError('invalid', `«${basename(String(source))}» no es un archivo.`)
        if (info.size > MAX_UPLOAD) {
          throw new AppError('invalid', `«${basename(source)}» pasa de 50 MB.`)
        }
        const path = joinPath(dir, this.vault.uniqueName(dir, safeName(basename(source))))
        await this.vault.copyIn(source, path)
        created.push(path)
      }
      await this.syncNow()
      const rows = await this.rows().find({ where: { path: In(created) } })
      return rows.map(toItem)
    })
  }

  attach(
    noteId: string,
    name: string,
    data: Uint8Array
  ): Promise<{ item: WorkspaceItem; link: string }> {
    return this.exclusive(async () => {
      const note = await this.rowOrFail(noteId)
      if (note.kind !== 'note') throw new AppError('invalid', 'Solo se adjunta a una nota.')
      if (!(data instanceof Uint8Array) || !data.byteLength)
        throw new AppError('invalid', 'El archivo está vacío.')
      if (data.byteLength > MAX_UPLOAD) throw new AppError('invalid', 'El archivo pasa de 50 MB.')
      const file = this.vault.uniqueName(ATTACHMENTS, safeName(name || `imagen-${Date.now()}.png`))
      const path = joinPath(ATTACHMENTS, file)
      await this.vault.writeBytes(path, data)
      const item = await this.afterWrite(path)
      const link = relativePath(dirName(note.path), path).replace(/ /g, '%20')
      return { item, link }
    })
  }

  fileBytes(path: string): Promise<FileBytes> {
    return this.vault.readBytes(path, PREVIEW_MAX_BYTES)
  }

  async readBoard(id: string): Promise<BoardContent> {
    const row = await this.rowOrFail(id)
    if (row.kind !== 'board') throw new AppError('invalid', 'Eso no es un board.')
    const json = await this.vault.readText(row.path)
    const entry = await this.vault.entry(row.path)
    return { item: toItem(row), json, modifiedAt: iso(entry?.mtimeMs ?? row.mtimeMs) }
  }

  writeBoard(id: string, json: string, expected?: string): Promise<BoardContent> {
    return this.exclusive(async () => {
      const row = await this.rowOrFail(id)
      if (row.kind !== 'board') throw new AppError('invalid', 'Eso no es un board.')
      let text: string
      try {
        text = serializeCanvas(parseCanvas(String(json ?? '')))
      } catch (error) {
        throw new AppError('invalid', (error as Error).message)
      }
      await this.checkUnchanged(row, expected)
      await this.vault.writeText(row.path, text)
      const fresh = await this.refreshOne(row.path)
      return { item: toItem(fresh), json: text, modifiedAt: iso(fresh.mtimeMs) }
    })
  }

  async boardSummary(
    id: string
  ): Promise<{ item: WorkspaceItem } & ReturnType<typeof summarizeCanvas>> {
    const board = await this.readBoard(id)
    try {
      return { item: board.item, ...summarizeCanvas(parseCanvas(board.json)) }
    } catch (error) {
      throw new AppError('invalid', (error as Error).message)
    }
  }

  editBoard(id: string, ops: BoardOp[]): Promise<{ created: string[]; item: WorkspaceItem }> {
    return this.exclusive(async () => {
      const row = await this.rowOrFail(id)
      if (row.kind !== 'board') throw new AppError('invalid', 'Eso no es un board.')
      if (!Array.isArray(ops) || !ops.length)
        throw new AppError('invalid', 'Pasa al menos una operación.')
      let result: ReturnType<typeof applyBoardOps>
      try {
        result = applyBoardOps(parseCanvas(await this.vault.readText(row.path)), ops)
      } catch (error) {
        throw new AppError('invalid', (error as Error).message)
      }
      await this.vault.writeText(row.path, serializeCanvas(result.canvas))
      const fresh = await this.refreshOne(row.path)
      return { created: result.created, item: toItem(fresh) }
    })
  }

  // ---------------------------------------------------------------- notas (las usa NoteService)

  async noteRow(id: string): Promise<WorkspaceRow> {
    const row = await this.rowOrFail(id)
    if (row.kind !== 'note') throw new AppError('not_found', 'No existe esa nota.')
    return row
  }

  async noteRows(folderId?: string | null): Promise<WorkspaceRow[]> {
    const notes = await this.rows().find({ where: { kind: 'note' }, order: { updatedAt: 'DESC' } })
    return folderId === undefined ? notes : notes.filter((n) => n.parentId === folderId)
  }

  async noteRowsByIds(ids: string[]): Promise<WorkspaceRow[]> {
    if (!ids.length) return []
    return this.rows().find({ where: { id: In(ids), kind: 'note' }, order: { updatedAt: 'DESC' } })
  }

  writeNote(id: string, text: string, expected?: string): Promise<WorkspaceRow> {
    return this.exclusive(async () => {
      const row = await this.noteRow(id)
      await this.checkUnchanged(row, expected)
      if (row.text === text) return row
      await this.vault.writeText(row.path, text)
      return this.refreshOne(row.path)
    })
  }

  createNoteAt(
    folderPath: string,
    fileName: string,
    text: string,
    keep: { id?: string; createdAt?: string; updatedAt?: string } = {}
  ): Promise<WorkspaceRow> {
    const { id, createdAt, updatedAt } = keep
    return this.exclusive(async () => {
      const path = joinPath(
        folderPath,
        this.vault.uniqueName(folderPath, `${safeName(fileName)}.md`)
      )
      await this.vault.writeText(path, text)
      if (updatedAt && !Number.isNaN(Date.parse(updatedAt)))
        await this.vault.touch(path, new Date(updatedAt))
      const entry = await this.vault.entry(path)
      if (!entry) throw new AppError('invalid', 'No se pudo crear la nota.')
      const row = await transactionGuard(this.db, async (m) => {
        const repo = m.getRepository(WorkspaceItemModel)
        const parent = folderPath ? await repo.findOneBy({ path: folderPath }) : null
        const fresh = rowFrom(entry, id ?? randomUUID(), parent?.id ?? null)
        fresh.text = text.slice(0, NOTE_MAX)
        if (createdAt) fresh.createdAt = createdAt
        await repo.insert(fresh)
        await this.replaceRefs(m, fresh)
        return fresh
      })
      return row
    })
  }

  renameNoteFile(id: string, fileName: string): Promise<WorkspaceRow> {
    return this.exclusive(async () => {
      const row = await this.noteRow(id)
      const wanted = `${safeName(fileName)}.md`
      if (baseName(row.path) === wanted) return row
      const dir = dirName(row.path)
      const path = joinPath(dir, this.vault.uniqueName(dir, wanted))
      await this.moveRow(row, path)
      return this.rowOrFail(id)
    })
  }

  async quickNotesFolder(): Promise<WorkspaceRow> {
    const found = await this.rows().findOneBy({ path: QUICK_NOTES })
    if (found) return found
    return this.exclusive(async () => {
      if (!this.vault.exists(QUICK_NOTES)) await this.vault.mkdir(QUICK_NOTES)
      await this.syncNow()
      return this.rows().findOneByOrFail({ path: QUICK_NOTES })
    })
  }

  // ---------------------------------------------------------------- internos

  private rows(): Repository<WorkspaceRow> {
    return this.db.getRepository(WorkspaceItemModel)
  }

  private refs(): Repository<WorkspaceRef> {
    return this.db.getRepository(WorkspaceRefModel)
  }

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work)
    this.chain = run.catch(() => undefined)
    return run
  }

  private async rowOrFail(id: unknown): Promise<WorkspaceRow> {
    const row = typeof id === 'string' && id ? await this.rows().findOneBy({ id }) : null
    if (!row) throw new AppError('not_found', 'Ese elemento ya no existe en el workspace.')
    return row
  }

  private async folderOrFail(id: string): Promise<WorkspaceRow> {
    const row = await this.rowOrFail(id)
    if (row.kind !== 'folder') throw new AppError('invalid', 'Eso no es una carpeta.')
    return row
  }

  private async folderPath(folderId: string | null | undefined): Promise<string> {
    return folderId ? (await this.folderOrFail(folderId)).path : ''
  }

  private async descendants(row: WorkspaceRow): Promise<WorkspaceRow[]> {
    if (row.kind !== 'folder') return []
    const all = await this.rows().find()
    return all.filter((r) => r.path.startsWith(`${row.path}/`))
  }

  private async crumbs(folder: WorkspaceRow | null): Promise<Crumb[]> {
    const out: Crumb[] = [{ id: null, name: 'Workspace' }]
    if (!folder) return out
    const parts = folder.path.split('/')
    const paths = parts.map((_, i) => parts.slice(0, i + 1).join('/'))
    const rows = await this.rows().find({ where: { path: In(paths) } })
    for (const p of paths) {
      const r = rows.find((x) => x.path === p)
      if (r) out.push({ id: r.id, name: r.name })
    }
    return out
  }

  private async checkUnchanged(row: WorkspaceRow, expected?: string): Promise<void> {
    if (!expected) return
    const entry = await this.vault.entry(row.path)
    if (entry && iso(entry.mtimeMs) !== expected) throw new AppError('conflict', CONFLICT_MESSAGE)
  }

  private async afterWrite(path: string): Promise<WorkspaceItem> {
    await this.syncNow()
    const row = await this.rows().findOneBy({ path })
    if (!row) throw new AppError('invalid', 'No se pudo guardar en el workspace.')
    return toItem(row)
  }

  private async moveRow(row: WorkspaceRow, path: string): Promise<WorkspaceItem> {
    const inside = await this.descendants(row)
    const moved = new Map<string, string>([[row.path, path]])
    for (const d of inside) moved.set(d.path, path + d.path.slice(row.path.length))
    const movedIds = [row.id, ...inside.map((d) => d.id)]

    await this.vault.move(row.path, path)

    // Quién hay que reescribir: lo que apunta a algo movido y las propias notas o boards movidos.
    const incoming = await this.refs().find({ where: { toId: In(movedIds) } })
    const sourceIds = new Set([...incoming.map((r) => r.fromId), ...movedIds])
    const sources = await this.rows().find({ where: { id: In([...sourceIds]) } })
    for (const source of sources) {
      if (source.kind !== 'note' && source.kind !== 'board') continue
      const oldPath = source.path
      const newPath = moved.get(oldPath) ?? oldPath
      try {
        const text = await this.vault.readText(newPath)
        const next =
          source.kind === 'note'
            ? rewriteMarkdownLinks(text, dirName(oldPath), dirName(newPath), moved)
            : serializeCanvas(rewriteCanvasFiles(parseCanvas(text), moved))
        if (next !== text) await this.vault.writeText(newPath, next)
      } catch {
        // Un archivo ilegible no bloquea el movimiento: su enlace queda como estaba.
      }
    }

    await this.syncNow()
    return toItem(await this.rowOrFail(row.id))
  }

  private async refreshOne(path: string): Promise<WorkspaceRow> {
    const entry = await this.vault.entry(path)
    if (!entry) throw new AppError('not_found', 'El archivo ya no existe.')
    const row = await transactionGuard(this.db, async (m) => {
      const repo = m.getRepository(WorkspaceItemModel)
      const current = await repo.findOneByOrFail({ path })
      Object.assign(current, {
        inode: entry.inode,
        size: entry.size,
        mtimeMs: entry.mtimeMs,
        updatedAt: iso(entry.mtimeMs)
      })
      if (current.kind === 'note')
        current.text = (await this.vault.readText(path)).slice(0, NOTE_MAX)
      await repo.save(current)
      await this.replaceRefs(m, current)
      return current
    })
    return row
  }

  private async syncNow(): Promise<boolean> {
    const disk = await this.vault.scan()
    const changed = await transactionGuard(this.db, async (m) => {
      const repo = m.getRepository(WorkspaceItemModel)
      const rows = await repo.find()
      const diskPaths = new Set(disk.map((e) => e.path))
      const byPath = new Map(rows.map((r) => [r.path, r]))
      const byInode = new Map(rows.map((r) => [r.inode, r]))
      const matched = new Set<string>()
      const contentChanged: WorkspaceRow[] = []
      const final: WorkspaceRow[] = []
      const updated = new Set<WorkspaceRow>()
      const inserted: WorkspaceRow[] = []
      let dirty = false

      for (const entry of disk) {
        let row = byPath.get(entry.path)
        if (row && matched.has(row.id)) row = undefined
        if (!row) {
          const candidate = byInode.get(entry.inode)
          if (
            candidate &&
            !matched.has(candidate.id) &&
            !diskPaths.has(candidate.path) &&
            candidate.kind === entry.kind
          ) {
            row = candidate
          }
        }
        if (row) {
          matched.add(row.id)
          const moved = row.path !== entry.path
          const touched = row.mtimeMs !== entry.mtimeMs || row.size !== entry.size
          if (moved || touched || row.inode !== entry.inode || row.kind !== entry.kind) {
            Object.assign(row, {
              path: entry.path,
              name: displayName(baseName(entry.path), entry.kind),
              kind: entry.kind,
              inode: entry.inode,
              size: entry.size,
              mtimeMs: entry.mtimeMs,
              updatedAt: iso(entry.mtimeMs)
            })
            // Un movimiento cambia a qué apuntan los enlaces relativos: también hay que releer.
            if (touched || moved) contentChanged.push(row)
            updated.add(row)
            dirty = true
          }
          final.push(row)
        } else {
          const fresh = rowFrom(entry, randomUUID(), null)
          final.push(fresh)
          inserted.push(fresh)
          contentChanged.push(fresh)
          dirty = true
        }
      }

      const gone = rows.filter((r) => !matched.has(r.id))
      if (gone.length) {
        const ids = gone.map((r) => r.id)
        await repo.delete({ id: In(ids) })
        await m.getRepository(WorkspaceRefModel).delete({ fromId: In(ids) })
        await m.getRepository(WorkspaceRefModel).delete({ toId: In(ids) })
        const notes = gone.filter((r) => r.kind === 'note').map((r) => r.id)
        if (notes.length) {
          await m.getRepository(NoteRelationModel).delete({ noteId: In(notes) })
          await m
            .getRepository(NoteRelationModel)
            .delete({ targetType: 'note', targetId: In(notes) })
        }
        dirty = true
      }

      // Carpeta madre por ruta (tras saber las rutas finales).
      const folderByPath = new Map(
        final.filter((r) => r.kind === 'folder').map((r) => [r.path, r.id])
      )
      for (const r of final) {
        const parent = folderByPath.get(dirName(r.path)) ?? null
        if (r.parentId !== parent) {
          r.parentId = parent
          if (!inserted.includes(r)) updated.add(r)
          dirty = true
        }
      }

      for (const r of contentChanged) {
        if (r.kind === 'note')
          r.text = (await this.vault.readText(r.path).catch(() => '')).slice(0, NOTE_MAX)
      }
      if (dirty) {
        // Solo se escribe lo que cambió: con miles de archivos, un sync sin cambios no toca la base.
        if (updated.size) await repo.save([...updated], { chunk: 200, reload: false })
        // De 50 en 50: SQLite limita las variables por sentencia.
        for (let i = 0; i < inserted.length; i += 50) await repo.insert(inserted.slice(i, i + 50))
        const pathToId = new Map(final.map((r) => [r.path, r.id]))
        for (const r of contentChanged) await this.replaceRefs(m, r, pathToId)
      }
      return dirty
    })
    if (changed) this.onChange()
    return changed
  }

  private async replaceRefs(
    m: EntityManager,
    row: WorkspaceRow,
    pathToId?: Map<string, string>
  ): Promise<void> {
    if (row.kind !== 'note' && row.kind !== 'board') return
    let paths: string[] = []
    if (row.kind === 'note') paths = noteRefs(row.text ?? '', dirName(row.path))
    else {
      try {
        paths = canvasFileRefs(parseCanvas(await this.vault.readText(row.path)))
      } catch {
        paths = []
      }
    }
    const refs = m.getRepository(WorkspaceRefModel)
    await refs.delete({ fromId: row.id })
    if (!paths.length) return
    let ids: string[]
    if (pathToId) ids = paths.map((p) => pathToId.get(p)).filter((x): x is string => Boolean(x))
    else
      ids = (await m.getRepository(WorkspaceItemModel).find({ where: { path: In(paths) } })).map(
        (r) => r.id
      )
    for (const toId of new Set(ids))
      if (toId !== row.id) await refs.insert({ fromId: row.id, toId })
  }
}

function rowFrom(entry: DiskEntry, id: string, parentId: string | null): WorkspaceRow {
  return {
    id,
    kind: entry.kind,
    path: entry.path,
    name: displayName(baseName(entry.path), entry.kind),
    parentId,
    inode: entry.inode,
    size: entry.size,
    mtimeMs: entry.mtimeMs,
    text: null,
    createdAt: entry.birthtime,
    updatedAt: iso(entry.mtimeMs)
  }
}

const KIND_ORDER = { folder: 0, note: 1, board: 2, image: 3, file: 4 }

function byKindThenName(a: WorkspaceItem, b: WorkspaceItem): number {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name, 'es')
}

function snippetAt(text: string, at: number, length: number): string {
  const start = Math.max(0, at - 50)
  const end = Math.min(text.length, at + length + 70)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`
}
