import { useCallback, useState } from 'react'
import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { sourceTag, type LeadSource, type TagRef } from '@shared/marketing'
import { api, attempt, shortDate, useLoad, type Go } from '../lib'
import { Button, Empty, ErrorNote, Page } from '../ui'
import { TagEditor } from '../marketing-ui'

const marketing = window.api.marketing

/**
 * Fuentes de leads: cada una es una URL del hub que acepta el formato único
 * `{ email, name, tags, fields }`. Todo lead que entra lleva el tag `origen-<fuente>`.
 */
export function Sources({ go }: { go: Go }): React.JSX.Element {
  const load = useCallback(() => marketing.listSources(), [])
  const { data: sources, error: loadError } = useLoad(load)
  const settingsLoad = useCallback(() => api.settings(), [])
  const { data: settings } = useLoad(settingsLoad)
  const tagsLoad = useCallback(() => marketing.listTags(), [])
  const { data: tags } = useLoad(tagsLoad)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    const name = draft?.trim()
    if (!name) return setDraft(null)
    const failed = await attempt(() => marketing.createSource({ name }))
    setError(failed)
    if (!failed) setDraft(null)
  }

  const hubUrl = settings?.hubUrl ?? ''

  return (
    <Page
      title="Fuentes"
      meta={<span>Cada fuente es una URL que recibe leads de un formulario, Zapier o Make.</span>}
      actions={
        <button
          type="button"
          onClick={() => setDraft('')}
          className="flex h-9 items-center gap-1.5 rounded-full bg-apricot pr-4 pl-3 text-caption font-extrabold text-ink transition-transform active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Nueva fuente
        </button>
      }
    >
      {settings && (!settings.hubUrl || !settings.hasHubToken) && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-md bg-apricot/10 px-5 py-3 text-caption text-apricot">
          <span>Conecta el hub (el Worker de Cloudflare) para que estas URLs funcionen.</span>
          <Button kind="primary" onClick={() => go({ name: 'settings' })}>
            Ir a Ajustes
          </Button>
        </div>
      )}

      {draft !== null && (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
            placeholder="Nombre de la fuente y Enter · p. ej. Web, Webinar octubre, Zapier"
            aria-label="Nombre de la fuente"
            className="h-[52px] w-full rounded-lg bg-surface px-5 text-body outline-none placeholder:text-milk-soft focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
          />
        </form>
      )}

      <ErrorNote message={error ?? loadError} />

      <div className="mt-6 flex flex-col gap-3">
        {sources?.length === 0 && (
          <Empty
            title="Aún no hay fuentes."
            hint="Crea una por cada sitio que te manda leads: así sabrás por dónde entra cada uno."
          />
        )}
        {sources?.map((s) => (
          <SourceCard key={s.id} source={s} hubUrl={hubUrl} tags={tags ?? []} onError={setError} />
        ))}
      </div>
    </Page>
  )
}

function SourceCard({
  source: s,
  hubUrl,
  tags,
  onError
}: {
  source: LeadSource
  hubUrl: string
  tags: TagRef[]
  onError: (message: string | null) => void
}): React.JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const url = hubUrl ? `${hubUrl}/in/${s.slug}` : `<URL del hub>/in/${s.slug}`
  const named = (slug: string): TagRef => tags.find((t) => t.slug === slug) ?? { slug, name: slug }
  const run = async (fn: () => Promise<unknown>): Promise<void> => onError(await attempt(fn))

  const curl = [
    `curl -X POST '${url}' \\`,
    `  -H 'Authorization: Bearer ${showSecret ? s.secret : '<secreto>'}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{"email":"ana@ejemplo.com","name":"Ana","tags":["webinar"],"fields":{"company":"Acme"}}'`
  ].join('\n')

  return (
    <section className="rounded-md bg-surface px-5 py-4" aria-label={`Fuente ${s.name}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-label font-extrabold">{s.name}</h2>
          <p className="mt-0.5 text-caption text-milk-soft tabular-nums">
            {s.receivedCount === 0
              ? 'Sin leads todavía'
              : `${s.receivedCount} ${s.receivedCount === 1 ? 'lead' : 'leads'} · último ${shortDate(s.lastReceivedAt)}`}
            {' · '}tag <span className="font-bold text-milk">{sourceTag(s.slug)}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() =>
              confirmRotate
                ? void run(() => marketing.rotateSourceSecret(s.slug))
                : setConfirmRotate(true)
            }
            onMouseLeave={() => setConfirmRotate(false)}
            onBlur={() => setConfirmRotate(false)}
            title="Generar un secreto nuevo (el actual deja de funcionar)"
            aria-label={confirmRotate ? 'Confirmar: secreto nuevo' : 'Secreto nuevo'}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-full text-caption font-extrabold transition-colors ${
              confirmRotate
                ? 'bg-apricot px-4 text-ink'
                : 'w-9 text-milk-soft hover:bg-hairline hover:text-milk'
            }`}
          >
            {confirmRotate ? '¿Secreto nuevo?' : <KeyRound size={16} />}
          </button>
          <button
            type="button"
            onClick={() =>
              confirmDelete
                ? void run(() => marketing.removeSource(s.slug))
                : setConfirmDelete(true)
            }
            onMouseLeave={() => setConfirmDelete(false)}
            onBlur={() => setConfirmDelete(false)}
            aria-label={confirmDelete ? 'Confirmar: borrar fuente' : 'Borrar fuente'}
            className={`flex h-9 items-center justify-center rounded-full text-caption font-extrabold transition-colors ${
              confirmDelete
                ? 'bg-rose px-4 text-ink'
                : 'w-9 text-milk-soft hover:bg-rose/15 hover:text-rose'
            }`}
          >
            {confirmDelete ? '¿Borrar?' : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      <dl className="mt-4 flex flex-col gap-1.5">
        <CopyRow label="URL" value={url} copyValue={hubUrl ? url : null} />
        <CopyRow
          label="Secreto"
          value={showSecret ? s.secret : '•'.repeat(24)}
          copyValue={s.secret}
          extra={
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="h-8 rounded-full px-3 text-caption font-bold text-milk-soft hover:bg-hairline hover:text-milk"
            >
              {showSecret ? 'Ocultar' : 'Ver'}
            </button>
          }
        />
      </dl>

      <div className="mt-3">
        <p className="mb-1.5 px-1 text-micro font-bold text-milk-soft">
          Tags extra para cada lead de esta fuente
        </p>
        <TagEditor
          tags={s.defaultTags.map(named)}
          suggestions={tags}
          onAdd={(tag) =>
            void run(() => marketing.updateSource(s.slug, { defaultTags: [...s.defaultTags, tag] }))
          }
          onRemove={(slug) =>
            void run(() =>
              marketing.updateSource(s.slug, {
                defaultTags: s.defaultTags.filter((t) => t !== slug)
              })
            )
          }
        />
      </div>

      <details className="group mt-3">
        <summary className="cursor-pointer list-none px-1 text-caption font-bold text-milk-soft hover:text-milk">
          Cómo enviarle un lead
        </summary>
        <p className="mt-2 px-1 text-caption text-milk-soft">
          POST con JSON. Solo <b className="text-milk">email</b> es obligatorio. El secreto va en la
          cabecera Authorization o, si la herramienta no permite cabeceras, como{' '}
          <b className="text-milk">?key=</b> en la URL. Envía solo personas que aceptaron recibir
          tus emails.
        </p>
        <pre className="mt-2 overflow-x-auto rounded-sm bg-night px-4 py-3 font-mono text-micro leading-relaxed text-milk-soft">
          {curl}
        </pre>
      </details>
    </section>
  )
}

function CopyRow({
  label,
  value,
  copyValue,
  extra
}: {
  label: string
  value: string
  copyValue: string | null
  extra?: React.ReactNode
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = async (): Promise<void> => {
    if (!copyValue) return
    await navigator.clipboard.writeText(copyValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-2 rounded-sm bg-night py-1 pr-1 pl-4">
      <dt className="w-16 shrink-0 text-micro font-bold text-milk-soft">{label}</dt>
      <dd
        className="min-w-0 flex-1 truncate font-mono text-micro text-milk"
        title={copyValue ?? undefined}
      >
        {value}
      </dd>
      {extra}
      <button
        type="button"
        onClick={() => void copy()}
        disabled={!copyValue}
        aria-label={`Copiar ${label.toLowerCase()}`}
        className="flex h-8 items-center gap-1 rounded-full px-3 text-caption font-bold text-milk-soft hover:bg-hairline hover:text-milk disabled:text-milk-faint disabled:hover:bg-transparent"
      >
        {copied ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}
