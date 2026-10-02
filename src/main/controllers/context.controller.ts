import type { Request, Response } from 'express'
import type { NoteEntity } from '@shared/consultora'
import type { ContextService } from '../services/context.service'
import { text } from './params'

/** Panorama, búsqueda, documentos y notas rápidas. */
export class ContextController {
  constructor(private readonly service: ContextService) {}

  overview = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.service.overview())
  }

  search = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.search(text(req.query.q) ?? ''))
  }

  documents = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.listDocuments(String(req.params.ref)))
  }

  readDocument = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.readDocument(String(req.params.ref), text(req.query.path) ?? ''))
  }

  /** `{ entity: 'client'|'project'|'prospect'|'meeting', ref, text }` */
  appendNote = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    await this.service.appendNote(
      body.entity as NoteEntity,
      String(body.ref ?? ''),
      String(body.text ?? '')
    )
    res.json({ ok: true })
  }
}
