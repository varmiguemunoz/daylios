import { randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { createWriteStream, type WriteStream } from 'fs'
import { copyFile, mkdir, mkdtemp, readdir, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, extname, join } from 'path'
import { promisify } from 'util'
import { Notification } from 'electron'
import ffmpegPath from 'ffmpeg-static'
import type { DataSource } from 'typeorm'
import { LANGUAGES, type ImportInfo, type Language, type Meeting, type StopInfo } from '@shared/consultora'
import { MeetingModel } from '../models/meeting.model'
import { ClientModel } from '../models/client.model'
import { ProjectModel } from '../models/project.model'
import { transactionGuard } from '../guards/transaction.guard'
import { config } from '../config'
import { AppError } from './app.error'
import { now } from './fields'
import type { MeetingService } from './meeting.service'
import type { AiService } from './ai.service'

const run = promisify(execFile)

/** ffmpeg incluido en la app. En la app empaquetada vive fuera del .asar. */
const FFMPEG = (ffmpegPath ?? 'ffmpeg').replace('app.asar', 'app.asar.unpacked')

/** Minutos por trozo de audio enviado a transcribir (muy por debajo del límite de 25 MB). */
const PART_SECONDS = 600

/**
 * Grabación de reuniones y su procesado.
 *
 * 1. start(): crea la reunión (estado `recording`) y el archivo .webm en `_reuniones/`.
 * 2. chunk(): el renderer manda trozos cada 5 s; se agregan al archivo.
 * 3. stop(): cierra el archivo, guarda título/participantes/asociación y lanza el procesado.
 * 4. process(): ffmpeg (audio 16 kHz en trozos de 10 min) → transcribir → resumir.
 *    Cada paso se guarda antes del siguiente: un reintento sigue desde donde quedó.
 */
export class RecordingService {
  private active: { meetingId: string; stream: WriteStream } | null = null
  private running = new Set<string>()

  constructor(
    private readonly db: DataSource,
    private readonly meetings: MeetingService,
    private readonly ai: AiService,
    /** Avisa a las ventanas de que hay datos nuevos. */
    private readonly onChange: () => void,
    /** Cambia el indicador del menubar. */
    private readonly onRecording: (recording: boolean) => void
  ) {}

  isRecording(): boolean {
    return this.active !== null
  }

  async start(): Promise<Meeting> {
    if (this.active) throw new AppError('invalid', 'Ya hay una grabación en curso.')

    const dir = join(config.docsPath(), '_reuniones')
    await mkdir(dir, { recursive: true })
    const date = new Date()
    const stamp = now()
    const meeting: Meeting = {
      id: randomUUID(),
      date: date.toISOString(),
      title: `Reunión ${fileStamp(date)}`,
      clientId: null,
      projectId: null,
      prospectId: null,
      participants: [],
      summaryMd: '',
      decisionsMd: '',
      actionItems: [],
      transcriptMd: '',
      rawNotesMd: '',
      recordingPath: join(dir, `${fileStamp(date)}.webm`),
      durationSec: null,
      language: null,
      status: 'recording',
      error: null,
      createdAt: stamp,
      updatedAt: stamp
    }
    await transactionGuard(this.db, (manager) =>
      manager.getRepository(MeetingModel).insert(meeting)
    )

    this.active = { meetingId: meeting.id, stream: createWriteStream(meeting.recordingPath!) }
    this.onRecording(true)
    this.onChange()
    return meeting
  }

  /** Agrega un trozo al archivo. Los trozos llegan en orden (el renderer los encola). */
  chunk(meetingId: string, data: Uint8Array): Promise<void> {
    const active = this.active
    if (!active || active.meetingId !== meetingId) return Promise.resolve()
    return new Promise((resolve, reject) =>
      active.stream.write(Buffer.from(data), (error) => (error ? reject(error) : resolve()))
    )
  }

  async stop(meetingId: string, info: StopInfo): Promise<Meeting> {
    if (this.active?.meetingId === meetingId) {
      const { stream } = this.active
      this.active = null
      await new Promise<void>((resolve) => stream.end(resolve))
      this.onRecording(false)
    }

    await this.meetings.update(meetingId, {
      title: info.title?.trim() || undefined,
      participants: info.participants ?? [],
      client: info.clientId ?? '',
      project: info.projectId ?? '',
      prospect: info.prospectId ?? ''
    })
    await this.patch(meetingId, {
      durationSec: Math.round(info.durationSec) || null,
      language: checkLanguage(info.language)
    })

    return this.process(meetingId)
  }

  /**
   * Sube una grabación que ya existía (video o audio): la copia a la carpeta de documentos
   * (el original no se toca), crea la reunión y lanza el mismo procesado que una grabación en vivo.
   * Fecha = fecha de creación del archivo; duración = la que reporta ffmpeg.
   */
  async import(source: string, info: ImportInfo): Promise<Meeting> {
    const ext = extname(source).toLowerCase()
    if (!IMPORT_EXTENSIONS.includes(ext)) {
      throw new AppError('invalid', `Formato no soportado. Usa: ${IMPORT_EXTENSIONS.join(', ')}.`)
    }
    const file = await stat(source).catch(() => null)
    if (!file?.isFile()) throw new AppError('not_found', 'No encuentro ese archivo.')

    const dir = join(config.docsPath(), '_reuniones')
    await mkdir(dir, { recursive: true })
    const date = file.birthtime.getTime() > 0 ? file.birthtime : file.mtime
    const target = join(dir, `${fileStamp(date)} ${basename(source, ext)}${ext}`)
    await copyFile(source, target)

    const stamp = now()
    const meeting: Meeting = {
      id: randomUUID(),
      date: date.toISOString(),
      title: info.title?.trim() || basename(source, ext),
      clientId: null,
      projectId: null,
      prospectId: null,
      participants: [],
      summaryMd: '',
      decisionsMd: '',
      actionItems: [],
      transcriptMd: '',
      rawNotesMd: '',
      recordingPath: target,
      durationSec: await mediaDuration(target),
      language: checkLanguage(info.language),
      status: 'transcribing',
      error: null,
      createdAt: stamp,
      updatedAt: stamp
    }
    await transactionGuard(this.db, (manager) => manager.getRepository(MeetingModel).insert(meeting))

    // Asociación (mueve el archivo a la carpeta del cliente si hay cliente) y participantes
    await this.meetings.update(meeting.id, {
      participants: info.participants ?? [],
      client: info.clientId ?? '',
      project: info.projectId ?? '',
      prospect: info.prospectId ?? ''
    })
    this.onChange()
    return this.process(meeting.id)
  }

  /** Lanza el procesado en segundo plano y devuelve la reunión al momento. */
  async process(meetingId: string): Promise<Meeting> {
    const meeting = await this.meetings.get(meetingId)
    if (meeting.status === 'recording' && this.active?.meetingId === meetingId) {
      throw new AppError('invalid', 'La reunión aún se está grabando.')
    }
    void this.runPipeline(meetingId)
    return meeting
  }

  /**
   * Al arrancar, grabaciones que quedaron a medias (la app se cerró o la captura nunca empezó):
   * - archivo vacío o inexistente: se borran la reunión y el archivo (no hay nada que salvar);
   * - con datos: pasan a error con «Reintentar» para procesar lo grabado.
   */
  async recoverInterrupted(): Promise<void> {
    const stuck = await this.db.getRepository(MeetingModel).findBy({ status: 'recording' })
    for (const meeting of stuck) {
      const size = meeting.recordingPath ? await fileSize(meeting.recordingPath) : 0
      await transactionGuard(this.db, async (manager) => {
        const repo = manager.getRepository(MeetingModel)
        if (size > 0) {
          await repo.update(
            { id: meeting.id },
            { status: 'error', error: 'La grabación se interrumpió. Pulsa «Reintentar» para procesar lo grabado.' }
          )
        } else {
          await repo.delete({ id: meeting.id })
          if (meeting.recordingPath) await rm(meeting.recordingPath, { force: true })
        }
      })
    }
  }

  // ---- internos ----

  private async runPipeline(id: string): Promise<void> {
    if (this.running.has(id)) return
    this.running.add(id)
    try {
      let meeting = await this.meetings.get(id)

      // 1. Transcribir (solo si hay grabación y aún no hay transcripción)
      if (!meeting.transcriptMd.trim() && meeting.recordingPath) {
        await this.patch(id, { status: 'transcribing', error: null })
        const transcript = await this.transcribe(meeting)
        await this.patch(id, { transcriptMd: transcript })
        meeting = await this.meetings.get(id)
      }

      // 2. Resumir transcripción + notas crudas
      const source = [
        meeting.transcriptMd,
        meeting.rawNotesMd.trim() ? `## Notas del dueño\n\n${meeting.rawNotesMd}` : ''
      ]
        .filter((t) => t.trim())
        .join('\n\n')
      if (!source) throw new AppError('invalid', 'No hay transcripción ni notas que resumir.')

      await this.patch(id, { status: 'summarizing', error: null })
      const summary = await this.ai.summarize(
        {
          title: meeting.title,
          date: meeting.date.slice(0, 10),
          participants: meeting.participants,
          about: await this.about(meeting)
        },
        source
      )
      await this.patch(id, { ...summary, status: 'ready', error: null })
      new Notification({ title: 'Reunión lista', body: meeting.title }).show()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.patch(id, { status: 'error', error: message }).catch(() => undefined)
    } finally {
      this.running.delete(id)
    }
  }

  /** webm → mp3 mono 16 kHz en trozos de 10 min (carpeta temporal) → texto. */
  private async transcribe(meeting: Meeting): Promise<string> {
    const temp = await mkdtemp(join(tmpdir(), 'daylios-'))
    try {
      await run(
        FFMPEG,
        [
          '-y',
          '-loglevel',
          'error',
          '-i',
          meeting.recordingPath!,
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-c:a',
          'libmp3lame',
          '-b:a',
          '48k',
          '-f',
          'segment',
          '-segment_time',
          String(PART_SECONDS),
          join(temp, 'part_%03d.mp3')
        ],
        { maxBuffer: 10 * 1024 * 1024 }
      )
      const parts = (await readdir(temp))
        .filter((f) => f.endsWith('.mp3'))
        .sort()
        .map((f) => join(temp, f))
      if (parts.length === 0) throw new AppError('invalid', 'La grabación no tiene audio.')

      const hint = [meeting.title, ...meeting.participants].join(', ')
      return await this.ai.transcribe(parts, hint, meeting.language)
    } finally {
      await rm(temp, { recursive: true, force: true })
    }
  }

  /** "Cliente Acme · Proyecto Portal" para darle contexto al resumen. */
  private async about(meeting: Meeting): Promise<string> {
    const client = meeting.clientId
      ? await this.db.getRepository(ClientModel).findOneBy({ id: meeting.clientId })
      : null
    const project = meeting.projectId
      ? await this.db.getRepository(ProjectModel).findOneBy({ id: meeting.projectId })
      : null
    return [client && `Cliente ${client.name}`, project && `Proyecto ${project.name}`]
      .filter(Boolean)
      .join(' · ')
  }

  /** Guarda campos internos del procesado (estado, transcripción, resumen) y avisa a las ventanas. */
  private async patch(id: string, fields: Partial<Meeting>): Promise<void> {
    await transactionGuard(this.db, (manager) =>
      manager.getRepository(MeetingModel).update({ id }, { ...fields, updatedAt: now() })
    )
    this.onChange()
  }
}

/** Formatos que se pueden subir (ffmpeg los lee todos). */
const IMPORT_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.mkv', '.webm', '.mp3', '.m4a', '.wav']

/** Idioma hablado válido o null (Whisper detecta solo). */
function checkLanguage(value: unknown): Language | null {
  return LANGUAGES.includes(value as Language) ? (value as Language) : null
}

/** Duración en segundos según ffmpeg («Duration: 00:12:34.56»). null si no se puede leer. */
async function mediaDuration(file: string): Promise<number | null> {
  // `ffmpeg -i` sin salida termina con error, pero antes imprime la duración en stderr.
  const stderr = await run(FFMPEG, ['-hide_banner', '-i', file]).then(
    (r) => r.stderr,
    (e: { stderr?: string }) => e.stderr ?? ''
  )
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(String(stderr))
  return m ? Math.round(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) : null
}

/** Tamaño en bytes; 0 si no existe. */
async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}

/** "2026-10-02 1015" en hora local. */
function fileStamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}${pad(date.getMinutes())}`
  )
}
