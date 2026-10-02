import { useCallback } from 'react'
import type { SearchHit } from '@shared/consultora'
import { api, useLoad, type Go, type Screen } from '../lib'
import { Empty, ErrorNote, List, Page, Pill, Row } from '../ui'

const TYPE: Record<SearchHit['type'], string> = {
  client: 'Cliente',
  project: 'Proyecto',
  meeting: 'Reunión',
  prospect: 'Prospecto'
}

const target = (hit: SearchHit): Screen => ({ name: hit.type, id: hit.id }) as Screen

/** Resultados de búsqueda en clientes, proyectos, reuniones (con transcripción) y prospectos. */
export function Search({ query, go }: { query: string; go: Go }): React.JSX.Element {
  const load = useCallback(() => api.search(query), [query])
  const { data, error } = useLoad(load)

  return (
    <Page title={`«${query}»`} meta={data && <span>{data.length} resultados</span>}>
      <ErrorNote message={error} />
      <div className="mt-6">
        {data && data.length === 0 && (
          <Empty title="Sin resultados." hint="Prueba con otra palabra." />
        )}
        {data && data.length > 0 && (
          <List>
            {data.map((hit) => (
              <Row key={`${hit.type}-${hit.id}`} onClick={() => go(target(hit))}>
                <Pill>{TYPE[hit.type]}</Pill>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-list font-bold">{hit.title}</span>
                  {hit.snippet && (
                    <span className="block truncate text-caption text-milk-soft">
                      {hit.snippet}
                    </span>
                  )}
                </span>
              </Row>
            ))}
          </List>
        )}
      </div>
    </Page>
  )
}
