import type { Request, Response } from 'express'
import type { NoteService } from '../services/note.service'
import { noteView, notesPageView } from '../views/note.view'

/** Controlador de notas: lee la petición, llama al servicio y responde con la vista. */
export class NoteController {
  constructor(private readonly service: NoteService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query.page ?? 1)
    const pageSize = Number(req.query.pageSize ?? 7)
    res.json(notesPageView(await this.service.list(page, pageSize)))
  }

  get = async (req: Request, res: Response): Promise<void> => {
    res.json(noteView(await this.service.get(String(req.params.id))))
  }

  view = async (req: Request, res: Response): Promise<void> => {
    const v = await this.service.view(String(req.params.id))
    res.json({ ...v, note: noteView(v.note) })
  }

  search = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.search(text(req.query.q) ?? '', Number(req.query.limit ?? 20)))
  }

  /** Body: `{ body, related_notes?, clients? }`. */
  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const links = { notes: list(body.related_notes), clients: list(body.clients) }
    res.status(201).json(noteView(await this.service.create(text(body.body) ?? '', links)))
  }

  /** Body: `{ type: 'note' | 'client', id }`. */
  link = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.link(String(req.params.id), req.body ?? {}))
  }

  unlink = async (req: Request, res: Response): Promise<void> => {
    const type = String(req.params.type) as 'note' | 'client'
    res.json(await this.service.unlink(String(req.params.id), { type, id: String(req.params.targetId) }))
  }

  update = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    res.json(noteView(await this.service.update(String(req.params.id), text(body.body) ?? '')))
  }

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.remove(String(req.params.id))
    res.json({ ok: true })
  }
}

const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
