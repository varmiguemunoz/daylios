import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { contactLabel } from '@shared/marketing'
import { api, attempt, useLoad, type Go } from '../lib'
import { Drawer, Empty, ErrorNote, FilterButton, List, Page, Row, SearchField } from '../ui'
import { Pager } from '../../components/Pager'
import { ContactStatusPill, TagList } from '../marketing-ui'
import { Initials } from '../molecules/Initials'
import {
  ContactFilters,
  EMPTY_CONTACT_FILTERS,
  activeContactFilters,
  type ContactFilterState
} from '../organisms/ContactFilters'

/**
 * Base de contactos: personas de clientes y prospectos, y leads de email.
 * En pantalla solo el buscador y la lista; los filtros viven en el panel derecho.
 */
export function Contacts({ go }: { go: Go }): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<ContactFilterState>(EMPTY_CONTACT_FILTERS)
  const [panel, setPanel] = useState(false)
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    () =>
      api.listContacts({
        query,
        status: filters.status === 'all' ? undefined : filters.status,
        tags: filters.tags.length ? filters.tags : undefined,
        source: filters.source || undefined,
        client: filters.client || undefined,
        inPipeline: filters.pipeline === 'any' ? undefined : filters.pipeline === 'yes',
        page
      }),
    [query, filters, page]
  )
  const { data, error: loadError } = useLoad(load)
  const tagsLoad = useCallback(() => window.api.marketing.listTags(), [])
  const { data: tags } = useLoad(tagsLoad)
  const sourcesLoad = useCallback(() => window.api.marketing.listSources(), [])
  const { data: sources } = useLoad(sourcesLoad)
  const refsLoad = useCallback(() => api.refs(), [])
  const { data: refs } = useLoad(refsLoad)

  const changeFilters = (next: ContactFilterState): void => {
    setFilters(next)
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

  const count = activeContactFilters(filters)
  const filtered = Boolean(query || count)

  return (
    <Page
      title="Contactos"
      meta={data && <span className="tabular-nums">{plural(data.total, 'contacto', 'contactos')}</span>}
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
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setDraft(null)
              }
            }}
            placeholder="Nombre o email y Enter · luego completas el resto"
            aria-label="Nombre o email del contacto"
            className="h-[52px] w-full rounded-lg bg-surface px-5 text-body outline-none placeholder:text-milk-soft focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
          />
        </form>
      )}

      <div className="mt-5 flex items-center gap-2">
        <SearchField
          value={query}
          onChange={(v) => {
            setQuery(v)
            setPage(1)
          }}
          placeholder="Nombre, rol, email, teléfono o empresa"
          label="Buscar contacto"
        />
        <FilterButton count={count} onClick={() => setPanel(true)} />
      </div>

      <ErrorNote message={error ?? loadError} />

      <div className="mt-5">
        {data && data.contacts.length === 0 && (
          <Empty
            title={filtered ? 'Nadie coincide.' : 'Aún no hay contactos.'}
            hint={
              filtered
                ? 'Prueba con otra palabra o quita algún filtro.'
                : 'Crea uno aquí, desde la ficha de un cliente o prospecto, o conecta una fuente de leads.'
            }
          />
        )}
        {data && data.contacts.length > 0 && (
          <>
            <List>
              {data.contacts.map((c) => {
                const secondary = [c.role, c.organization].filter(Boolean).join(' · ')
                return (
                  <Row key={c.id} onClick={() => go({ name: 'contact', id: c.id })}>
                    <Initials name={contactLabel(c)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-list font-bold">{contactLabel(c)}</span>
                      <span className="block truncate text-caption text-milk-soft">
                        {secondary || (c.name ? c.email : null) || c.phone || 'Sin empresa'}
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

      <Drawer
        open={panel}
        title="Filtros"
        onClose={() => setPanel(false)}
        footer={
          <button
            type="button"
            disabled={!count}
            onClick={() => changeFilters(EMPTY_CONTACT_FILTERS)}
            className="h-9 rounded-full px-4 text-caption font-bold text-milk-soft transition-colors hover:bg-surface-raised hover:text-milk disabled:text-milk-faint"
          >
            Limpiar filtros
          </button>
        }
      >
        <ContactFilters
          value={filters}
          onChange={changeFilters}
          tags={tags ?? []}
          sources={sources ?? []}
          clients={(refs?.clients ?? []).map((c) => ({ id: c.id, name: c.name }))}
        />
      </Drawer>
    </Page>
  )
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
