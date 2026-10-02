import { useCallback, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { api, attempt, useLoad, type Go } from '../lib'
import { Empty, ErrorNote, List, Page, Row } from '../ui'

/** Base de contactos: todas las personas de clientes y prospectos, con búsqueda y alta rápida. */
export function Contacts({ go }: { go: Go }): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => api.listContacts({ query }), [query])
  const { data, error: loadError } = useLoad(load)

  const create = async (): Promise<void> => {
    if (!name?.trim()) return setName(null)
    let id = ''
    const failed = await attempt(async () => {
      id = (await api.createContact({ name })).id
    })
    setError(failed)
    if (!failed) go({ name: 'contact', id })
  }

  return (
    <Page
      title="Contactos"
      actions={
        <button
          type="button"
          onClick={() => setName('')}
          className="flex h-9 items-center gap-1.5 rounded-full bg-apricot pr-4 pl-3 text-caption font-extrabold text-ink transition-transform active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Nuevo contacto
        </button>
      }
    >
      <label className="mt-5 flex h-11 items-center gap-2 rounded-full bg-surface px-4 focus-within:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]">
        <Search size={15} strokeWidth={2.5} className="text-milk-soft" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre, rol, email o empresa"
          aria-label="Buscar contacto"
          className="min-w-0 flex-1 bg-transparent text-list outline-none"
        />
      </label>

      {name !== null && (
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setName(null)}
            placeholder="Nombre y Enter · luego completas el resto"
            aria-label="Nombre del contacto"
            className="h-[52px] w-full rounded-lg bg-surface px-5 text-body outline-none focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
          />
        </form>
      )}

      <ErrorNote message={error ?? loadError} />

      <div className="mt-6">
        {data && data.length === 0 && (
          <Empty
            title={query ? 'Nadie coincide.' : 'Aún no hay contactos.'}
            hint={query ? 'Prueba con otra palabra.' : 'Crea uno aquí o desde la ficha de un cliente o prospecto.'}
          />
        )}
        {data && data.length > 0 && (
          <List>
            {data.map((c) => (
              <Row key={c.id} onClick={() => go({ name: 'contact', id: c.id })}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-list font-bold">{c.name}</span>
                  <span className="block truncate text-caption text-milk-soft">
                    {[c.role, c.organization].filter(Boolean).join(' · ') || 'Sin empresa'}
                  </span>
                </span>
                <span className="shrink-0 truncate text-caption text-milk-soft">{c.email ?? c.phone ?? ''}</span>
              </Row>
            ))}
          </List>
        )}
      </div>
    </Page>
  )
}
