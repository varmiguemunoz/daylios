import { useCallback, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type { NewsletterStatus } from '@shared/marketing'
import { attempt, dateTime, shortDate, useLoad } from '../lib'
import { Empty, ErrorNote, List, Page, Pill, Section } from '../ui'

const marketing = window.api.marketing

const STATUS: Record<NewsletterStatus, { tone: 'mint' | 'apricot' | 'coral'; label: string }> = {
  sent: { tone: 'mint', label: 'Enviado' },
  scheduled: { tone: 'apricot', label: 'Programado' },
  sending: { tone: 'apricot', label: 'Enviando…' },
  failed: { tone: 'coral', label: 'Falló' }
}

/**
 * Newsletter diario: lo escribe y lo envía Claude (uno por día como máximo). Aquí se ve el
 * historial con su vista previa, a quién puede llegar y el interruptor de pausa.
 */
export function Newsletters(): React.JSX.Element {
  const ctxLoad = useCallback(() => marketing.newsletterContext(), [])
  const { data: ctx } = useLoad(ctxLoad)
  const listLoad = useCallback(() => marketing.listNewsletters(), [])
  const { data: list, error: loadError } = useLoad(listLoad)
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const togglePause = async (): Promise<void> => {
    if (!ctx) return
    setError(await attempt(() => marketing.setNewsletterPaused(!ctx.paused)))
  }

  return (
    <Page
      title="Newsletters"
      meta={
        ctx && (
          <span>
            {ctx.paused
              ? 'En pausa: Claude no puede enviar.'
              : ctx.sentToday
                ? 'El de hoy ya salió.'
                : 'Claude lo escribe y lo envía. Máximo uno por día.'}
          </span>
        )
      }
      actions={
        ctx && (
          <button
            type="button"
            onClick={() => void togglePause()}
            aria-pressed={ctx.paused}
            className={`flex h-[30px] items-center gap-1.5 rounded-[4px] px-3 text-[13px] font-medium transition-colors ${
              ctx.paused
                ? 'bg-ob-accent text-white hover:bg-[#7a4fe0]'
                : 'bg-ob-active text-ob-text hover:bg-[#3f3f3f]'
            }`}
          >
            {ctx.paused ? <Play size={15} /> : <Pause size={15} />}
            {ctx.paused ? 'Reanudar' : 'Pausar'}
          </button>
        )
      }
    >
      <ErrorNote message={error ?? loadError} />

      <Section title="Audiencias">
        {ctx && ctx.tags.length === 0 ? (
          <Empty
            title="Ningún tag tiene suscritos."
            hint="El newsletter va a los suscritos de un tag. Llegan con las fuentes o al suscribir contactos."
          />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ctx?.tags.map((t) => (
              <span
                key={t.slug}
                title={t.slug}
                className="inline-flex h-8 items-center gap-1.5 rounded-[4px] bg-ob-active px-3 text-[13px]"
              >
                {t.name}
                <span className="text-ob-muted tabular-nums">{t.subscribed}</span>
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Historial">
        {list?.length === 0 && (
          <Empty
            title="Aún no se ha enviado ninguno."
            hint="Programa en Claude una tarea diaria que use get_newsletter_context y send_newsletter."
          />
        )}
        {list && list.length > 0 && (
          <List>
            {list.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setOpen(open === n.id ? null : n.id)}
                  aria-expanded={open === n.id}
                  className="flex min-h-8 w-full items-center gap-3 px-2 py-1.5 text-left transition-colors outline-offset-[-2px] hover:bg-ob-hover focus-visible:bg-ob-hover"
                >
                  <span className="w-24 shrink-0 text-caption text-ob-muted tabular-nums">
                    {shortDate(n.day)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-list font-medium">{n.subject}</span>
                    <span className="block truncate text-caption text-ob-muted">
                      {n.tag}
                      {n.scheduledAt && ` · programado: ${n.scheduledAt}`}
                    </span>
                  </span>
                  <Pill tone={STATUS[n.status].tone}>{STATUS[n.status].label}</Pill>
                </button>
                {open === n.id && <Preview id={n.id} />}
              </li>
            ))}
          </List>
        )}
      </Section>
    </Page>
  )
}

/** Vista previa aislada (iframe sin scripts) y el error si falló. */
function Preview({ id }: { id: string }): React.JSX.Element {
  const load = useCallback(() => marketing.getNewsletter(id), [id])
  const { data: n, error } = useLoad(load)
  return (
    <div className="px-4 pb-4">
      <ErrorNote message={error ?? (n?.error ? `Resend: ${n.error}` : null)} />
      {n && (
        <>
          <p className="mt-2 mb-2 text-caption text-ob-muted">Creado {dateTime(n.createdAt)}</p>
          <iframe
            title={`Vista previa: ${n.subject}`}
            sandbox=""
            srcDoc={n.html}
            className="h-[480px] w-full rounded-sm bg-ob-text"
          />
        </>
      )}
    </div>
  )
}
