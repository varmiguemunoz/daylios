import { createReadStream } from 'fs'
import OpenAI from 'openai'
import type { ActionItem } from '@shared/consultora'
import { config } from '../config'
import { AppError } from './app.error'

export interface SummaryContext {
  title: string
  date: string
  participants: string[]
  /** "Cliente Acme · Proyecto Portal" */
  about: string
}

export interface Summary {
  summaryMd: string
  decisionsMd: string
  actionItems: ActionItem[]
}

/** Texto máximo por llamada de resumen; más largo se resume por partes y luego se une. */
const PART_CHARS = 120_000

/** Lo que el modelo debe devolver (Structured Outputs: JSON validado, sin parsear texto libre). */
const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'decisions', 'action_items'],
  properties: {
    summary: {
      type: 'string',
      description: 'Resumen ejecutivo en markdown, 1 a 3 párrafos cortos.'
    },
    decisions: { type: 'array', items: { type: 'string' }, description: 'Decisiones tomadas.' },
    action_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'owner', 'due'],
        properties: {
          text: { type: 'string', description: 'Tarea concreta.' },
          owner: { type: ['string', 'null'], description: 'Responsable, como se le nombra.' },
          due: {
            type: ['string', 'null'],
            description: 'Fecha límite: YYYY-MM-DD si se puede deducir.'
          }
        }
      }
    }
  }
} as const

/** OpenAI: transcripción (Whisper) y resumen estructurado. Solo corre en main; la key nunca sale de aquí. */
export class AiService {
  private client(): OpenAI {
    const apiKey = config.openaiKey()
    if (!apiKey) {
      throw new AppError('invalid', 'Falta la API key de OpenAI. Añádela en Consultora → Ajustes.')
    }
    return new OpenAI({ apiKey })
  }

  /** Comprueba la API key guardada con una llamada mínima (lista de modelos). */
  async testKey(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.client().models.list()
      return { ok: true, message: 'Conexión correcta con OpenAI.' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Transcribe los trozos en orden y los une. `hint` mejora nombres propios (clientes, personas);
   * `language` es el idioma hablado ('es' | 'en'), si se conoce.
   */
  async transcribe(files: string[], hint: string, language?: 'es' | 'en' | null): Promise<string> {
    const openai = this.client()
    const parts: string[] = []
    for (const file of files) {
      const result = await openai.audio.transcriptions.create({
        file: createReadStream(file),
        model: config.transcribeModel(),
        prompt: hint || undefined,
        // Idioma hablado: mejora la precisión y evita que Whisper traduzca o mezcle idiomas
        language: language ?? undefined
      })
      parts.push(result.text.trim())
    }
    return parts.filter(Boolean).join('\n\n')
  }

  /**
   * Convierte un dictado en una nota markdown: primera línea `# Título`, párrafos, listas
   * y casillas `- [ ]` para tareas. Mismo idioma del dictado, sin muletillas y sin inventar.
   */
  async formatNote(transcript: string): Promise<string> {
    const response = await this.client().chat.completions.create({
      model: config.summaryModel(),
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Conviertes un dictado de voz en una nota markdown clara. Reglas: ' +
            'la primera línea es "# " seguido de un título corto (máx. 8 palabras); ' +
            'ordena el contenido en párrafos cortos, listas o casillas "- [ ] " cuando se mencionen tareas o pendientes; ' +
            'usa **negrita** solo para nombres, fechas o cifras clave; ' +
            'escribe en el mismo idioma del dictado; quita muletillas y repeticiones; ' +
            'no añadas nada que no se haya dicho. Responde solo con el markdown, sin ``` ni comentarios.'
        },
        { role: 'user', content: `Fecha: ${new Date().toISOString().slice(0, 10)}\n\nDictado:\n${transcript}` }
      ]
    })
    const text = response.choices[0]?.message?.content?.trim()
    if (!text) throw new AppError('invalid', 'El modelo no devolvió la nota.')
    // Por si el modelo envuelve la respuesta en ```markdown … ```
    return text.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/, '').trim()
  }

  /** Resumen ejecutivo, decisiones y action items. Textos largos: resume por partes y luego une. */
  async summarize(context: SummaryContext, text: string): Promise<Summary> {
    if (text.length <= PART_CHARS) return this.summarizeOnce(context, text)

    const partials: Summary[] = []
    for (const part of splitText(text, PART_CHARS))
      partials.push(await this.summarizeOnce(context, part))

    const joined = partials
      .map(
        (p, i) =>
          `## Parte ${i + 1}\n\n${p.summaryMd}\n\n### Decisiones\n${p.decisionsMd}\n\n### Action items\n` +
          p.actionItems
            .map((a) => `- ${a.text} (${a.owner ?? '¿?'}, ${a.due ?? 'sin fecha'})`)
            .join('\n')
      )
      .join('\n\n')
    return this.summarizeOnce(
      context,
      `Resúmenes parciales de una reunión larga. Únelos sin repetir:\n\n${joined}`
    )
  }

  private async summarizeOnce(context: SummaryContext, text: string): Promise<Summary> {
    const response = await this.client().chat.completions.create({
      model: config.summaryModel(),
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'meeting_summary', strict: true, schema: SUMMARY_SCHEMA }
      },
      messages: [
        {
          role: 'system',
          content:
            'Eres el asistente de una consultora de ingeniería de software y AI. Resumes reuniones con clientes y prospectos. ' +
            `Responde en idioma "${config.summaryLanguage()}". Sé concreto: nombres, cifras, fechas, alcance. ` +
            'No inventes nada que no esté en el texto. Cada action item es una tarea concreta con su responsable ' +
            'y fecha límite si se dijo (convierte "el viernes" a YYYY-MM-DD usando la fecha de la reunión).'
        },
        {
          role: 'user',
          content:
            `Reunión: ${context.title}\nFecha: ${context.date}\n` +
            `${context.about ? `Sobre: ${context.about}\n` : ''}` +
            `Participantes: ${context.participants.join(', ') || 'sin indicar'}\n\n` +
            `Transcripción / notas:\n\n${text}`
        }
      ]
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new AppError('invalid', 'El modelo no devolvió resumen.')
    const data = JSON.parse(raw) as {
      summary: string
      decisions: string[]
      action_items: { text: string; owner: string | null; due: string | null }[]
    }
    return {
      summaryMd: data.summary.trim(),
      decisionsMd: data.decisions.map((d) => `- ${d}`).join('\n'),
      actionItems: data.action_items.map((a) => ({ ...a, done: false }))
    }
  }
}

/** Parte un texto largo en trozos de ~`size` caracteres, cortando en saltos de línea. */
function splitText(text: string, size: number): string[] {
  const parts: string[] = []
  let rest = text
  while (rest.length > size) {
    const cut = rest.lastIndexOf('\n', size)
    const at = cut > size / 2 ? cut : size
    parts.push(rest.slice(0, at))
    rest = rest.slice(at)
  }
  if (rest.trim()) parts.push(rest)
  return parts
}
