import { randomUUID } from 'crypto'
import { In, Not, type DataSource } from 'typeorm'
import {
  UNSUBSCRIBE_PLACEHOLDER,
  localDay,
  segmentName,
  slugify,
  withUnsubscribeFooter,
  type Newsletter,
  type NewsletterBrief,
  type NewsletterContext,
  type NewsletterInput
} from '@shared/marketing'
import { ContactTagModel, NewsletterModel, OutboxModel, TagModel } from '../models/marketing.model'
import { transactionGuard } from '../guards/transaction.guard'
import { config, saveSettings } from '../config'
import { AppError } from './app.error'
import { now, optionalText, requiredText } from './fields'
import type { GatewayProvider } from './resend.provider'
import type { TagService } from './tag.service'

const MAX_HTML = 500_000

/**
 * Newsletter diario. Lo escribe y lo envía Claude (MCP `send_newsletter`), sin revisión, así que
 * las salvaguardas viven aquí: pausa global, uno por día local, tag con suscritos, pie de baja,
 * copia previa al dueño e historial. Lo envía Resend como Broadcast al Segment del tag.
 */
export class NewsletterService {
  constructor(
    private readonly db: DataSource,
    private readonly gateway: GatewayProvider,
    private readonly tags: TagService,
    /** Vacía la cola hacia Resend (el segment debe tener a todos los suscritos del tag). */
    private readonly flush: () => Promise<void> = async () => {}
  ) {}

  async list(limit = 60): Promise<NewsletterBrief[]> {
    const rows = await this.db
      .getRepository(NewsletterModel)
      .find({ order: { createdAt: 'DESC' }, take: Math.min(Math.max(limit, 1), 200) })
    // Sin el HTML: la lista no lo necesita y puede pesar mucho.
    return rows.map((row) => {
      const brief: NewsletterBrief & { html?: string } = { ...row }
      delete brief.html
      return brief
    })
  }

  async get(id: unknown): Promise<Newsletter> {
    const row =
      typeof id === 'string' ? await this.db.getRepository(NewsletterModel).findOneBy({ id }) : null
    if (!row) throw new AppError('not_found', 'No existe ese newsletter.')
    return row
  }

  /** Lo que Claude necesita para escribir el de hoy sin repetirse. */
  async context(): Promise<NewsletterContext> {
    const recent = await this.db
      .getRepository(NewsletterModel)
      .find({ order: { createdAt: 'DESC' }, take: 30 })
    const today = localDay()
    return {
      paused: config.newsletterPaused(),
      sentToday: recent.some((n) => n.day === today && n.status !== 'failed'),
      recent: recent.map(({ day, tag, subject, status }) => ({ day, tag, subject, status })),
      tags: (await this.tags.list())
        .filter((t) => t.subscribed > 0)
        .map(({ slug, name, subscribed }) => ({ slug, name, subscribed }))
    }
  }

  setPaused(paused: unknown): { paused: boolean } {
    saveSettings({ newsletterPaused: paused === true })
    return { paused: config.newsletterPaused() }
  }

  async send(input: NewsletterInput): Promise<Newsletter> {
    // ---- Salvaguardas antes de tocar nada ----
    if (config.newsletterPaused()) {
      throw new AppError(
        'invalid',
        'El newsletter está en pausa (Ajustes o pantalla Newsletters). No se envió nada.'
      )
    }
    const g = this.gateway()
    if (!g) throw new AppError('invalid', 'Falta la API key de Resend (Ajustes → Email).')
    const from = config.from()
    if (!from) throw new AppError('invalid', 'Falta el remitente (Ajustes → Email).')

    const subject = requiredText(input.subject, 'El asunto', 200)
    if (typeof input.html !== 'string' || !input.html.trim())
      throw new AppError('invalid', 'Falta el contenido (html).')
    if (input.html.length > MAX_HTML)
      throw new AppError('invalid', 'El contenido es demasiado largo.')
    const html = withUnsubscribeFooter(input.html)
    const scheduledAt = optionalText(input.scheduledAt, 'La hora de envío', 100)

    const slug = slugify(requiredText(input.tag, 'El tag', 60))
    const summary = (await this.tags.list()).find((t) => t.slug === slug)
    if (!summary)
      throw new AppError('invalid', `No existe el tag «${input.tag}». Usa get_newsletter_context.`)
    if (summary.subscribed === 0)
      throw new AppError('invalid', `«${summary.name}» no tiene suscritos. No se envió nada.`)

    // ---- Reservar el día (en la misma transacción que la comprobación: nunca dos el mismo día) ----
    const day = localDay()
    const stamp = now()
    const row: Newsletter = {
      id: randomUUID(),
      day,
      tag: slug,
      subject,
      html,
      status: 'sending',
      broadcastId: null,
      error: null,
      scheduledAt,
      createdAt: stamp,
      updatedAt: stamp
    }
    await transactionGuard(this.db, async (manager) => {
      const repo = manager.getRepository(NewsletterModel)
      const already = await repo.findOneBy({ day, status: Not('failed') })
      if (already)
        throw new AppError(
          'invalid',
          `Ya hay un newsletter hoy («${already.subject}»). Máximo uno por día.`
        )
      await repo.save(row)
    })

    try {
      // El segment debe existir y tener a todos los suscritos del tag.
      await this.flush()
      const tags = this.db.getRepository(TagModel)
      const tag = await tags.findOneByOrFail({ slug })
      const members = (await this.db.getRepository(ContactTagModel).findBy({ tagId: tag.id })).map(
        (l) => l.contactId
      )
      const unsynced = members.length
        ? await this.db.getRepository(OutboxModel).countBy({ kind: 'contact', ref: In(members) })
        : 0
      if (unsynced) {
        throw new Error(
          `${unsynced} contacto(s) de «${summary.name}» aún no están sincronizados con Resend y se quedarían sin recibirlo`
        )
      }
      if (!tag.segmentId) {
        tag.segmentId = await g.ensureSegment(segmentName(slug))
        await tags.update({ id: tag.id }, { segmentId: tag.segmentId })
      }

      // Copia previa al dueño: si no llega, no se envía a la lista.
      const owner = config.ownerEmail()
      if (owner) {
        await g.sendEmail({
          from,
          to: owner,
          replyTo: config.replyTo() || undefined,
          subject: `[Copia] ${subject}`,
          html: html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, '#')
        })
      }

      row.broadcastId = await g.sendBroadcast({
        segmentId: tag.segmentId,
        from,
        replyTo: config.replyTo() || undefined,
        subject,
        html,
        name: `Newsletter ${day} · ${summary.name}`,
        scheduledAt: scheduledAt ?? undefined
      })
      row.status = scheduledAt ? 'scheduled' : 'sent'
    } catch (error) {
      row.status = 'failed'
      row.error = (error instanceof Error ? error.message : String(error)).slice(0, 500)
    }
    row.updatedAt = now()
    await transactionGuard(this.db, (manager) => manager.getRepository(NewsletterModel).save(row))
    if (row.status === 'failed') {
      throw new AppError(
        'invalid',
        `No se envió: ${row.error}. Quedó en el historial; puedes reintentar hoy.`
      )
    }
    return row
  }
}
