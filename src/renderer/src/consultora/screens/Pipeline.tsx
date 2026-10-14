import { useCallback, useMemo, useState } from 'react'
import { Columns3, List as ListIcon, Pencil, Plus } from 'lucide-react'
import type { ProspectCard, StageKind } from '@shared/consultora'
import type { TagRef } from '@shared/marketing'
import { todayKey } from '@shared/tasks'
import {
  EMPTY_PIPELINE_FILTERS,
  activePipelineFilters,
  matchesProspect,
  type PipelineFilters
} from '@shared/pipeline-filters'
import { api, attempt, money, useLoad, type Go } from '../lib'
import { Button, Drawer, ErrorNote, FilterButton, INPUT, SegmentedToggle } from '../ui'
import { uiState, useUiState } from '../../lib/ui-state'
import { PipelineBoard } from '../organisms/pipeline/PipelineBoard'
import { PipelineTable } from '../organisms/pipeline/PipelineTable'
import { PipelineFiltersPanel } from '../organisms/pipeline/PipelineFiltersPanel'
import { PipelineEditorModal } from '../organisms/pipeline/PipelineEditorModal'
import { errorMessage } from '../../lib/api'

type View = 'board' | 'list'

const NEW = '__new__'

const stored = {
  get: (k: string): string | null => {
    const v = uiState.get<unknown>(k, null)
    return typeof v === 'string' ? v : null
  },
  set: (k: string, v: string): void => uiState.set(k, v)
}

export function Pipeline({ go }: { go: Go }): React.JSX.Element {
  const [pipelineId, setPipelineId] = useState<string>(() => stored.get('pipeline.last') ?? '')
  const [view, setView] = useState<View>(
    () => (stored.get(`pipeline.view.${pipelineId}`) as View) || 'board'
  )
  const [filters, setFilters] = useUiState<PipelineFilters>(
    'pipeline.filters',
    EMPTY_PIPELINE_FILTERS,
    (v) => !!v && typeof v === 'object' && !Array.isArray(v)
  )
  const [panel, setPanel] = useState(false)
  const [editor, setEditor] = useState<'edit' | 'new' | null>(null)
  const [company, setCompany] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const today = todayKey()

  const listLoad = useCallback(() => api.listPipelines(), [])
  const { data: pipelines } = useLoad(listLoad)
  // Un pipeline recordado que ya no existe cae al primero.
  const load = useCallback(
    () => api.pipeline(pipelineId || undefined).catch(() => api.pipeline()),
    [pipelineId]
  )
  const { data, error: loadError, reload } = useLoad(load)

  const choose = (id: string): void => {
    if (id === NEW) return setEditor('new')
    setPipelineId(id)
    stored.set('pipeline.last', id)
    setView((stored.get(`pipeline.view.${id}`) as View) || 'board')
    setFilters(EMPTY_PIPELINE_FILTERS)
  }

  const changeView = (v: View): void => {
    setView(v)
    if (data) stored.set(`pipeline.view.${data.pipeline.id}`, v)
  }

  const visible = useCallback(
    (card: ProspectCard, kind: StageKind) => matchesProspect(card, kind, filters, today),
    [filters, today]
  )

  const tags = useMemo(() => {
    const seen = new Map<string, TagRef>()
    for (const s of data?.stages ?? [])
      for (const p of s.prospects) for (const t of p.tags) seen.set(t.slug, t)
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [data])

  const move = (id: string, stageId: string, index?: number): void => {
    api
      .moveProspect(id, stageId, index)
      .then((r) => {
        setError(null)
        setNotice(r.client ? `Ganado: «${r.client.name}» ya es cliente y tiene su carpeta.` : null)
      })
      .catch((e) => setError(errorMessage(e)))
  }

  const create = async (stageId: string | undefined, name: string): Promise<boolean> => {
    if (!name.trim() || !data) return false
    let id = ''
    const failed = await attempt(async () => {
      id = (
        await api.createProspect({
          company: name.trim(),
          pipeline: data.pipeline.id,
          stage: stageId
        })
      ).id
    })
    setError(failed)
    if (!failed && !stageId) go({ name: 'prospect', id })
    return !failed
  }

  const count = activePipelineFilters(filters)
  const current = data?.pipeline.id ?? ''

  return (
    <div className="@container flex h-full min-h-0 flex-col pt-4 pl-6">
      <header className="flex flex-wrap items-center gap-2 pr-6">
        <h1 className="sr-only">Pipeline</h1>
        <select
          value={current}
          onChange={(e) => choose(e.target.value)}
          aria-label="Pipeline"
          className="h-8 max-w-64 cursor-pointer truncate rounded-[4px] bg-transparent pr-2 pl-1.5 text-[20px] font-semibold text-ob-text outline-none hover:bg-ob-hover"
        >
          {(pipelines ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {current && !(pipelines ?? []).some((p) => p.id === current) && data && (
            <option value={current}>{data.pipeline.name}</option>
          )}
          <option value={NEW}>+ Nuevo pipeline</option>
        </select>
        {data && (
          <span className="px-2 text-[13px] text-ob-muted">
            {money(data.openValueUsd)} abiertos
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <SegmentedToggle
            label="Vista"
            value={view}
            onChange={changeView}
            options={[
              { id: 'board', label: 'Columnas', icon: Columns3 },
              { id: 'list', label: 'Lista', icon: ListIcon }
            ]}
          />
          <FilterButton count={count} onClick={() => setPanel(true)} />
          <Button onClick={() => setEditor('edit')} disabled={!data}>
            <Pencil size={14} />
            Editar<span className="hidden @3xl:inline">&nbsp;pipeline</span>
          </Button>
          <button
            type="button"
            onClick={() => setCompany('')}
            className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-[4px] bg-ob-accent px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#7a4fe0] disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus size={16} />
            Nuevo<span className="hidden @3xl:inline">&nbsp;prospecto</span>
          </button>
        </div>
      </header>

      {filters.query && (
        <p className="mt-3 pr-6 text-[13px] text-ob-muted">
          Buscando «{filters.query}» ·{' '}
          <button
            type="button"
            className="font-medium text-ob-text hover:text-ob-link"
            onClick={() => setFilters({ ...filters, query: '' })}
          >
            Quitar
          </button>
        </p>
      )}

      {company !== null && (
        <form
          className="mt-4 pr-6"
          onSubmit={(e) => {
            e.preventDefault()
            void create(undefined, company).then((ok) => ok && setCompany(null))
          }}
        >
          <input
            autoFocus
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setCompany(null)
              }
            }}
            placeholder="Empresa o persona y Enter (va a la primera columna abierta)"
            aria-label="Empresa del prospecto"
            className={INPUT}
          />
        </form>
      )}
      {notice && (
        <p className="mt-4 mr-6 rounded-[6px] border-l-2 border-ob-green bg-ob-green/10 px-3 py-2 text-[13px] text-ob-green">
          {notice}
        </p>
      )}
      <div className="pr-6">
        <ErrorNote message={error ?? loadError} />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {data && view === 'board' && (
          <PipelineBoard
            data={data}
            visible={visible}
            today={today}
            onOpen={(id) => go({ name: 'prospect', id })}
            onMove={(id, stageId, index) => move(id, stageId, index)}
            onCreate={create}
          />
        )}
        {data && view === 'list' && (
          <div className="scroll-area min-h-0 flex-1 overflow-y-auto pr-6 pb-10">
            <PipelineTable
              data={data}
              visible={visible}
              today={today}
              onOpen={(id) => go({ name: 'prospect', id })}
              onStage={(id, stageId) => move(id, stageId)}
            />
          </div>
        )}
      </div>

      <Drawer
        open={panel}
        title="Filtros"
        onClose={() => setPanel(false)}
        footer={
          <button
            type="button"
            onClick={() => setFilters(EMPTY_PIPELINE_FILTERS)}
            disabled={!count && !filters.query}
            className="h-[30px] rounded-[4px] px-3 text-[13px] text-ob-muted transition-colors hover:bg-ob-hover hover:text-ob-text disabled:text-ob-faint"
          >
            Limpiar filtros
          </button>
        }
      >
        <PipelineFiltersPanel filters={filters} onChange={setFilters} tags={tags} />
      </Drawer>

      <PipelineEditorModal
        open={editor !== null}
        pipeline={editor === 'edit' ? data : null}
        pipelines={pipelines ?? []}
        onClose={() => setEditor(null)}
        onSaved={(id) => {
          setEditor(null)
          choose(id)
          void reload()
        }}
        onDeleted={(next) => {
          setEditor(null)
          choose(next)
        }}
      />
    </div>
  )
}
