import { mkdir, readdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { noteTitle, type Note, type VoiceResult } from '@shared/notes'
import type { NoteService } from './note.service'
import type { AiService } from './ai.service'

/** Grabaciones más cortas que esto se ignoran (pulsación accidental del atajo). */
const MIN_SECONDS = 1
const MIN_BYTES = 2_000

/**
 * Notas de voz: audio del micrófono → transcribir (Whisper) → el modelo escribe la nota
 * en markdown → se guarda en Notas.
 *
 * El audio se escribe primero en `<userData>/voice-pending/`. Si todo sale bien se borra;
 * si falla la transcripción se queda ahí y Ajustes ofrece «Reintentar».
 * Si falla solo el formato, se guarda la transcripción tal cual: lo dicho nunca se pierde.
 */
export class VoiceNoteService {
  private readonly dir: string

  constructor(
    dataDir: string,
    private readonly notes: NoteService,
    private readonly ai: AiService,
    /** Avisa a las ventanas (Notas se recarga) y muestra la notificación. */
    private readonly onCreated: (note: Note) => void
  ) {
    this.dir = join(dataDir, 'voice-pending')
  }

  async finish(data: Uint8Array, seconds: number): Promise<VoiceResult> {
    if (seconds < MIN_SECONDS || data.byteLength < MIN_BYTES) return { status: 'ignored' }
    await mkdir(this.dir, { recursive: true })
    const file = join(this.dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.webm`)
    await writeFile(file, data)
    return this.process(file)
  }

  /** Cuántos audios esperan reintento. */
  async pending(): Promise<number> {
    return (await this.pendingFiles()).length
  }

  /** Reprocesa los audios que fallaron, uno detrás de otro. */
  async retry(): Promise<{ created: number; failed: number }> {
    let created = 0
    let failed = 0
    for (const file of await this.pendingFiles()) {
      const result = await this.process(file)
      if (result.status === 'created') created++
      if (result.status === 'failed') failed++
    }
    return { created, failed }
  }

  // ---- internos ----

  private async process(file: string): Promise<VoiceResult> {
    let transcript: string
    try {
      transcript = (await this.ai.transcribe([file], '')).trim()
    } catch (error) {
      return { status: 'failed', message: message(error) } // el audio se queda para reintentar
    }

    if (!transcript) {
      await rm(file, { force: true })
      return { status: 'ignored' }
    }

    let body: string
    try {
      body = await this.ai.formatNote(transcript)
    } catch {
      body = `# Nota de voz\n\n## Sin formato\n\n${transcript}`
    }

    try {
      const note = await this.notes.create(body)
      await rm(file, { force: true })
      this.onCreated(note)
      return { status: 'created', title: noteTitle(note.body), noteId: note.id }
    } catch (error) {
      return { status: 'failed', message: message(error) }
    }
  }

  private async pendingFiles(): Promise<string[]> {
    try {
      return (await readdir(this.dir))
        .filter((f) => f.endsWith('.webm'))
        .sort()
        .map((f) => join(this.dir, f))
    } catch {
      return []
    }
  }
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))
