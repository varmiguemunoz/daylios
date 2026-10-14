import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import type { ContactsPage } from '@shared/consultora'
import { contactLabel } from '@shared/marketing'
import { api, attempt, useLoad, type Go } from '../lib'
import { useUiState } from '../../lib/ui-state'
import { Button, Drawer, Empty, ErrorNote, FilterButton, INPUT, Page, SearchField } from '../ui'
import { Pager } from '../../components/Pager'
import { ContactStatusPill, TagList } from '../marketing-ui'
import { Table, type Column } from '../molecules/Table'
import {
  ContactFilters,
  EMPTY_CONTACT_FILTERS,
  activeContactFilters,
  type ContactFilterState
} from '../organisms/ContactFilters'
import { freshClass, useFresh } from '../organisms/live/RemoteChanges'

type ContactRow = ContactsPage['contacts'][number]

const COLUMNS: Column<ContactRow>[] = [
  { key: 'name', label: 'Nombre', width: '26%', render: (c) => contactLabel(c) },
  {
    key: 'org',
    label: 'Rol y empresa',
    render: (c) =>
      [c.role, c.organization].filter(Boolean).join(' · ') || (
        <span className="text-ob-faint">Sin empresa</span>
      )
  },
  { key: 'email', label: 'Email', hideBelow: 'md', render: (c) => c.email ?? c.phone ?? '' },
  {
    key: 'tags',
    label: 'Tags',
    hideBelow: 'lg',
    width: '200px',
    render: (c) => <TagList tags={c.tags} />
  },
  {
    key: 'status',
    label: 'Email marketing',
    width: '130px',
    render: (c) => <ContactStatusPill status={c.status} />
  }
]

export function Contacts({ go }: { go: Go }): React.JSX.Element {
  const fresh = useFresh('contacts')
  // Búsqueda, filtros y página se recuerdan (ui-state.json).
  const [query, setQuery] = useUiState('contacts.query', '', (v) => typeof v === 'string')
  const [filters, setFilters] = useUiState<ContactFilterState>(
    'contacts.filters',
    EMPTY_CONTACT_FILTERS,
    (v) => !!v && typeof v === 'object' && Array.isArray((v as ContactFilterState).tags)
  )
  const [panel, setPanel] = useState(false)
  const [page, setPage] = useUiState(
    'contacts.page',
    1,
    (v) => Number.isInteger(v) && (v as number) > 0
  )
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
      meta={
        data && <span className="tabular-nums">{plural(data.total, 'contacto', 'contactos')}</span>
      }
      actions={
        <Button kind="primary" onClick={() => setDraft('')}>
          <Plus size={15} />
          Nuevo contacto
        </Button>
      }
    >
      {draft !== null && (
        <form
          className="mt-4"
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
            className={INPUT}
          />
        </form>
      )}

      <div className="mt-4 flex items-center gap-2">
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

      <div className="mt-4">
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
            <Table
              label="Contactos"
              columns={COLUMNS}
              rows={data.contacts}
              rowKey={(c) => c.id}
              onOpen={(c) => go({ name: 'contact', id: c.id })}
              rowClass={(c) => freshClass(fresh(c.id))}
            />
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
            className="h-[30px] rounded-[4px] px-3 text-[13px] text-ob-muted transition-colors hover:bg-ob-hover hover:text-ob-text disabled:text-ob-faint"
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
