import { useCallback, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { contactLabel, type ContactStatus } from '@shared/marketing'
import { api, attempt, useLoad, type Go } from '../lib'
import { Empty, ErrorNote, List, Page, Row, Select } from '../ui'
import { Pager } from '../../components/Pager'
import { Chips, ContactStatusPill, TagList } from '../marketing-ui'

type StatusFilter = ContactStatus | 'all'

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'subscribed', label: 'Suscritos' },
  { id: 'none', label: 'Sin marketing' },
  { id: 'unsubscribed', label: 'Bajas' },
  { id: 'bounced', label: 'Rebotes' },
  { id: 'complained', label: 'Spam' }
]

/**
 * Base de contactos: personas de clientes y prospectos, y leads de email.
 * Búsqueda, filtros por estado de suscripción y tag, alta rápida con nombre o email.
 */
export function Contacts({ go }: { go: Go }): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [tag, setTag] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    () =>
      api.listContacts({
        query,
        status: status === 'all' ? undefined : status,
        tag: tag || undefined,
        source: source || undefined,
        page
      }),
    [query, status, tag, source, page]
  )
  const { data, error: loadError } = useLoad(load)
  const tagsLoad = useCallback(() => window.api.marketing.listTags(), [])
  const { data: tags } = useLoad(tagsLoad)
  const sourcesLoad = useCallback(() => window.api.marketing.listSources(), [])
  const { data: sources } = useLoad(sourcesLoad)

  // Cambiar un filtro vuelve a la primera página.
  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T): void => {
      set(v)
      setPage(1)
    }

  /** Una sola caja: si parece un email, crea con email; si no, con nombre. */
  const create = async (): Promise<void> => {
    const value = draft?.trim()
    if (!value) return setDraft(null)
    let id = ''
    const failed = await attempt(async () => {
      id = (await api.createContact(value.includes('@') ? { email: value } : { name: value })).id
    })
    setError(failed)
    if (!failed) go({ name: 'contact', id })
  }

  const filtered = Boolean(query || tag || source || status !== 'all')

  return (
    <Page
      title="Contactos"
      meta={
        data && <span className="tabular-nums">{plural(data.total, 'contacto', 'contactos')}</span>
      }
      actions={
        <button
          type="button"
          onClick={() => setDraft('')}
          className="flex h-9 items-center gap-1.5 rounded-full bg-apricot pr-4 pl-3 text-caption font-extrabold text-ink transition-transform active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Nuevo contacto
        </button>
      }
    >
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
            placeholder="Nombre o email y Enter · luego completas el resto"
            aria-label="Nombre o email del contacto"
            className="h-[52px] w-full rounded-lg bg-surface px-5 text-body outline-none placeholder:text-milk-soft focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
          />
        </form>
      )}

      <div className="mt-5 flex items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-4 focus-within:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]">
          <Search size={15} strokeWidth={2.5} className="text-milk-soft" aria-hidden />
          <input
            value={query}
            onChange={(e) => filter(setQuery)(e.target.value)}
            placeholder="Nombre, rol, email o empresa"
            aria-label="Buscar contacto"
            className="min-w-0 flex-1 bg-transparent text-list outline-none placeholder:text-milk-soft"
          />
        </label>
        {tags && tags.length > 0 && (
          <Select
            label="Tag"
            value={tag}
            options={[
              { value: '', label: 'Todos los tags' },
              ...tags.map((t) => ({ value: t.slug, label: `${t.name} · ${t.contacts}` }))
            ]}
            onChange={filter(setTag)}
          />
        )}
        {sources && sources.length > 0 && (
          <Select
            label="Fuente"
            value={source}
            options={[
              { value: '', label: 'Todas las fuentes' },
              { value: 'manual', label: 'A mano' },
              ...sources.map((s) => ({ value: s.slug, label: s.name }))
            ]}
            onChange={filter(setSource)}
          />
        )}
      </div>

      <div className="mt-3">
        <Chips
          label="Suscripción"
          value={status}
          options={STATUS_FILTERS}
          onChange={filter(setStatus)}
        />
      </div>

      <ErrorNote message={error ?? loadError} />

      <div className="mt-6">
        {data && data.contacts.length === 0 && (
          <Empty
            title={filtered ? 'Nadie coincide.' : 'Aún no hay contactos.'}
            hint={
              filtered
                ? 'Prueba con otro filtro o palabra.'
                : 'Crea uno aquí, desde la ficha de un cliente o prospecto, o conecta una fuente de leads.'
            }
          />
        )}
        {data && data.contacts.length > 0 && (
          <>
            <List>
              {data.contacts.map((c) => {
                const secondary = [c.name ? c.email : null, c.role, c.organization]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <Row key={c.id} onClick={() => go({ name: 'contact', id: c.id })}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-list font-bold">{contactLabel(c)}</span>
                      <span className="block truncate text-caption text-milk-soft">
                        {secondary || (c.phone ?? 'Sin empresa')}
                      </span>
                    </span>
                    <TagList tags={c.tags} />
                    <ContactStatusPill status={c.status} />
                  </Row>
                )
              })}
            </List>
            <div className="mt-2">
              <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />
            </div>
          </>
        )}
      </div>
    </Page>
  )
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
