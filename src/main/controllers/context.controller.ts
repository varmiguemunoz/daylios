import type { Request, Response } from 'express'
import type { NoteEntity } from '@shared/consultora'
import type { ContextService } from '../services/context.service'
import { text } from './params'

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

  writeDocument = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    res.json(
      await this.service.writeDocument(
        String(req.params.ref),
        String(body.path ?? ''),
        String(body.content ?? ''),
        text(body.expectedModifiedAt)
      )
    )
  }

  renameDocument = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    res.json(
      await this.service.renameDocument(
        String(req.params.ref),
        String(body.path ?? ''),
        String(body.name ?? '')
      )
    )
  }

  trashDocument = async (req: Request, res: Response): Promise<void> => {
    const path = text(req.query.path) ?? ''
    if (req.query.confirm !== '1') {
      res.json({ needsConfirm: true, path })
      return
    }
    await this.service.trashDocument(String(req.params.ref), path)
    res.json({ ok: true })
  }

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
