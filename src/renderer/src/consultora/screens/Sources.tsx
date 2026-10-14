import { useCallback, useState } from 'react'
import { Check, Copy, KeyRound, Plus } from 'lucide-react'
import { sourceTag, type LeadSource, type TagRef } from '@shared/marketing'
import { api, attempt, shortDate, useLoad, type Go } from '../lib'
import { Button, ConfirmButton, Empty, ErrorNote, Page } from '../ui'
import { TagEditor } from '../marketing-ui'

const marketing = window.api.marketing

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
          className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-[4px] bg-ob-accent px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#7a4fe0] disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={16} />
          Nueva fuente
        </button>
      }
    >
      {settings && (!settings.hubUrl || !settings.hasHubToken) && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-[6px] border-l-2 border-ob-accent bg-ob-accent/10 px-3 py-2 text-caption text-ob-link">
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
            className="h-8 w-full rounded-[4px] border border-ob-border bg-ob-bg px-2.5 text-[14px] text-ob-text outline-none placeholder:text-ob-faint focus:border-ob-accent"
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
    <section
      className="rounded-[6px] border border-ob-border px-4 py-3"
      aria-label={`Fuente ${s.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold">{s.name}</h2>
          <p className="mt-0.5 text-caption text-ob-muted tabular-nums">
            {s.receivedCount === 0
              ? 'Sin leads todavía'
              : `${s.receivedCount} ${s.receivedCount === 1 ? 'lead' : 'leads'} · último ${shortDate(s.lastReceivedAt)}`}
            {' · '}tag <span className="font-medium text-ob-text">{sourceTag(s.slug)}</span>
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
            className={`flex h-[30px] items-center justify-center gap-1.5 rounded-[4px] text-caption font-semibold transition-colors ${
              confirmRotate
                ? 'bg-ob-accent px-4 text-white'
                : 'w-9 text-ob-muted hover:bg-ob-border hover:text-ob-text'
            }`}
          >
            {confirmRotate ? '¿Secreto nuevo?' : <KeyRound size={16} />}
          </button>
          <ConfirmButton
            label="Borrar fuente"
            onConfirm={() => void run(() => marketing.removeSource(s.slug))}
          />
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
              className="h-8 rounded-[4px] px-3 text-caption font-medium text-ob-muted hover:bg-ob-border hover:text-ob-text"
            >
              {showSecret ? 'Ocultar' : 'Ver'}
            </button>
          }
        />
      </dl>

      <div className="mt-3">
        <p className="mb-1.5 px-1 text-micro font-medium text-ob-muted">
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
        <summary className="cursor-pointer list-none px-1 text-caption font-medium text-ob-muted hover:text-ob-text">
          Cómo enviarle un lead
        </summary>
        <p className="mt-2 px-1 text-caption text-ob-muted">
          POST con JSON. Solo <b className="text-ob-text">email</b> es obligatorio. El secreto va en
          la cabecera Authorization o, si la herramienta no permite cabeceras, como{' '}
          <b className="text-ob-text">?key=</b> en la URL. Envía solo personas que aceptaron recibir
          tus emails.
        </p>
        <pre className="mt-2 overflow-x-auto rounded-[4px] bg-[#2a2a2a] px-3 py-2.5 font-mono text-micro leading-relaxed text-ob-muted">
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
    <div className="flex items-center gap-2 rounded-[4px] bg-[#2a2a2a] py-1 pr-1 pl-3">
      <dt className="w-16 shrink-0 text-micro font-medium text-ob-muted">{label}</dt>
      <dd
        className="min-w-0 flex-1 truncate font-mono text-micro text-ob-text"
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
        className="flex h-8 items-center gap-1 rounded-[4px] px-3 text-caption font-medium text-ob-muted hover:bg-ob-border hover:text-ob-text disabled:text-ob-faint disabled:hover:bg-transparent"
      >
        {copied ? <Check size={14} className="text-ob-green" /> : <Copy size={14} />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}
