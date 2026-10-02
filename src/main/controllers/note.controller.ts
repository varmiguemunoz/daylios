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

  create = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    res.status(201).json(noteView(await this.service.create(text(body.body) ?? '')))
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
