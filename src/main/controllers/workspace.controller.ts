import type { Request, Response } from 'express'
import type { WorkspaceService } from '../services/workspace.service'
import { flag, text } from './params'

/** Workspace por HTTP (lo usa Claude vía MCP). Los elementos se nombran por id o por ruta. */
export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  info = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.service.info())
  }

  tree = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.service.tree())
  }

  /** `?folder=<id|ruta>`; sin él, la raíz. */
  list = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.list(await this.service.resolveFolder(text(req.query.folder))))
  }

  search = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.search(text(req.query.q) ?? ''))
  }

  get = async (req: Request, res: Response): Promise<void> => {
    const item = await this.item(req)
    res.json(await this.service.content(item.id))
  }

  impact = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.impact((await this.item(req)).id))
  }

  /** Body: `{ parent?, name }`. */
  createFolder = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const parent = await this.service.resolveFolder(text(body.parent))
    res.status(201).json(await this.service.createFolder(parent, text(body.name) ?? ''))
  }

  /** Body: `{ folder?, name?, body? }`. */
  createNote = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const folder = await this.service.resolveFolder(text(body.folder))
    res
      .status(201)
      .json(
        await this.service.createNote(
          folder,
          text(body.name) ?? 'Sin título',
          text(body.body) ?? ''
        )
      )
  }

  /** Body: `{ folder?, name? }`. */
  createBoard = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const folder = await this.service.resolveFolder(text(body.folder))
    res.status(201).json(await this.service.createBoard(folder, text(body.name)))
  }

  /** Body: `{ name?, folder? }`: renombrar, mover o las dos cosas. */
  update = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    let item = await this.item(req)
    if (body.folder !== undefined)
      item = await this.service.move(item.id, await this.service.resolveFolder(text(body.folder)))
    if (text(body.name)) item = await this.service.rename(item.id, text(body.name)!)
    res.json(item)
  }

  /** Body: `{ body }`. Reescribe una nota. */
  writeNote = async (req: Request, res: Response): Promise<void> => {
    const item = await this.item(req)
    await this.service.writeNote(item.id, typeof req.body?.body === 'string' ? req.body.body : '')
    res.json(await this.service.content(item.id))
  }

  /** Body: `{ json }`. Reescribe un board entero. */
  writeBoard = async (req: Request, res: Response): Promise<void> => {
    const item = await this.item(req)
    res.json(
      await this.service.writeBoard(
        item.id,
        typeof req.body?.json === 'string' ? req.body.json : ''
      )
    )
  }

  /** Board compacto: nodos y conexiones. */
  board = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.boardSummary((await this.item(req)).id))
  }

  /** Body: `{ ops: [...] }` (add_node, update_node, remove_node, add_edge, remove_edge). */
  boardOps = async (req: Request, res: Response): Promise<void> => {
    const item = await this.item(req)
    const result = await this.service.editBoard(
      item.id,
      Array.isArray(req.body?.ops) ? req.body.ops : []
    )
    res.json({ created: result.created, ...(await this.service.boardSummary(item.id)) })
  }

  /** Sin `?confirm=1` devuelve el impacto y no borra. Con él, a la Papelera de macOS. */
  remove = async (req: Request, res: Response): Promise<void> => {
    const item = await this.item(req)
    if (!flag(req.query.confirm)) {
      res.json({ needsConfirm: true, item, impact: await this.service.impact(item.id) })
      return
    }
    await this.service.remove(item.id)
    res.json({ ok: true })
  }

  private item(req: Request) {
    return this.service.resolve(String(req.params.ref ?? ''))
  }
}
