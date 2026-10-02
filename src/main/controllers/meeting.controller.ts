import type { Request, Response } from 'express'
import type { MeetingService } from '../services/meeting.service'
import type { RecordingService } from '../services/recording.service'
import { meetingView } from '../views/consultora.view'
import { flag, int, text } from './params'

/** Reuniones y action items. */
export class MeetingController {
  constructor(
    private readonly service: MeetingService,
    private readonly recordings: RecordingService
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    res.json(
      await this.service.list({
        client: text(req.query.client),
        project: text(req.query.project),
        prospect: text(req.query.prospect),
        from: text(req.query.from),
        to: text(req.query.to),
        page: int(req.query.page),
        pageSize: int(req.query.pageSize)
      })
    )
  }

  /** `?transcript=1` incluye la transcripción completa. */
  get = async (req: Request, res: Response): Promise<void> => {
    res.json(meetingView(await this.service.get(String(req.params.id)), flag(req.query.transcript)))
  }

  create = async (req: Request, res: Response): Promise<void> => {
    res.status(201).json(meetingView(await this.service.create(req.body ?? {})))
  }

  update = async (req: Request, res: Response): Promise<void> => {
    res.json(meetingView(await this.service.update(String(req.params.id), req.body ?? {})))
  }

  updateActionItem = async (req: Request, res: Response): Promise<void> => {
    const index = int(req.params.index) ?? -1
    res.json(
      meetingView(await this.service.updateActionItem(String(req.params.id), index, req.body ?? {}))
    )
  }

  /** Transcribe (si falta) y resume en segundo plano. Devuelve la reunión al momento. */
  process = async (req: Request, res: Response): Promise<void> => {
    res.json(meetingView(await this.recordings.process(String(req.params.id))))
  }

  /** `{ path, language: 'es'|'en', title?, participants?, clientId?, projectId?, prospectId? }` */
  importRecording = async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {}
    const meeting = await this.recordings.import(String(body.path ?? ''), {
      title: text(body.title) ?? '',
      participants: Array.isArray(body.participants) ? body.participants : [],
      clientId: text(body.clientId) ?? null,
      projectId: text(body.projectId) ?? null,
      prospectId: text(body.prospectId) ?? null,
      language: body.language
    })
    res.status(201).json(meetingView(meeting))
  }

  actionItems = async (req: Request, res: Response): Promise<void> => {
    res.json(
      await this.service.listActionItems({
        client: text(req.query.client),
        done: req.query.done === undefined ? false : flag(req.query.done)
      })
    )
  }
}
