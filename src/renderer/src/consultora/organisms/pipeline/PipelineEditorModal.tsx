import { useState } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  STAGE_KINDS,
  type Pipeline,
  type PipelineSummary,
  type StageKind
} from '@shared/consultora'
import { api, attempt } from '../../lib'
import { Button, ConfirmButton, ErrorNote, IconButton, Modal } from '../../ui'
import { finalIndex, useReorder } from '../../../lib/useReorder'

interface Draft {
  /** id de la etapa existente; vacío = nueva. */
  id: string
  key: string
  name: string
  kind: StageKind
  /** Prospectos que tiene hoy (para pedir a dónde moverlos si se borra). */
  count: number
}

interface PipelineEditorModalProps {
  open: boolean
  /** null = pipeline nuevo. */
  pipeline: Pipeline | null
  pipelines: PipelineSummary[]
  onClose: () => void
  onSaved: (pipelineId: string) => void
  onDeleted: (nextPipelineId: string) => void
}

const KIND_LABEL: Record<StageKind, string> = { open: 'Abierta', won: 'Ganada', lost: 'Perdida' }

const DEFAULTS: Omit<Draft, 'key'>[] = [
  { id: '', name: 'Lead', kind: 'open', count: 0 },
  { id: '', name: 'Contactado', kind: 'open', count: 0 },
  { id: '', name: 'Propuesta', kind: 'open', count: 0 },
  { id: '', name: 'Ganado', kind: 'won', count: 0 },
  { id: '', name: 'Perdido', kind: 'lost', count: 0 }
]

let seq = 0
const key = (): string => `k${++seq}`

/** Editar el pipeline desde el pipeline: nombre, columnas (ordenar, renombrar, tipo, añadir, borrar) y borrarlo. */
export function PipelineEditorModal(props: PipelineEditorModalProps): React.JSX.Element | null {
  if (!props.open) return null
  // Montado solo al abrir: el estado inicial sale del pipeline actual.
  return <Editor {...props} key={props.pipeline?.pipeline.id ?? 'new'} />
}

function Editor({
  pipeline,
  pipelines,
  onClose,
  onSaved,
  onDeleted
}: PipelineEditorModalProps): React.JSX.Element {
  const [name, setName] = useState(pipeline?.pipeline.name ?? '')
  const [stages, setStages] = useState<Draft[]>(() =>
    pipeline
      ? pipeline.stages.map((s) => ({
          id: s.id,
          key: s.id,
          name: s.name,
          kind: s.kind,
          count: s.prospects.length
        }))
      : DEFAULTS.map((d) => ({ ...d, key: key() }))
  )
  const [removed, setRemoved] = useState<Draft[]>([])
  const [moves, setMoves] = useState<Record<string, string>>({})
  const [moveTo, setMoveTo] = useState(
    pipelines.find((p) => p.id !== pipeline?.pipeline.id)?.id ?? ''
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** Fila cuyo asa está pulsada: solo esa es arrastrable. */
  const [grab, setGrab] = useState<string | null>(null)

  const total = pipeline?.stages.reduce((n, s) => n + s.prospects.length, 0) ?? 0
  const keptExisting = stages.filter((s) => s.id)

  const drag = useReorder((k, index) => {
    const from = stages.findIndex((s) => s.key === k)
    if (from < 0) return
    const next = [...stages]
    const [moved] = next.splice(from, 1)
    next.splice(finalIndex(index, from), 0, moved)
    setStages(next)
  })

  const patch = (k: string, change: Partial<Draft>): void =>
    setStages((list) => list.map((s) => (s.key === k ? { ...s, ...change } : s)))

  const remove = (stage: Draft): void => {
    setStages((list) => list.filter((s) => s.key !== stage.key))
    if (stage.id && stage.count) {
      setRemoved((list) => [...list, stage])
      const target = keptExisting.find((s) => s.key !== stage.key)
      if (target) setMoves((m) => ({ ...m, [stage.id]: target.id }))
    }
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    let id = ''
    const failed = await attempt(async () => {
      const saved = await api.savePipeline({
        id: pipeline?.pipeline.id,
        name: name.trim(),
        stages: stages.map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          name: s.name.trim(),
          kind: s.kind
        })),
        moves: removed.map((s) => ({ from: s.id, to: moves[s.id] ?? '' }))
      })
      id = saved.pipeline.id
    })
    setSaving(false)
    if (failed) return setError(failed)
    onSaved(id)
  }

  const removePipeline = async (): Promise<void> => {
    const failed = await attempt(() =>
      api.removePipeline(pipeline!.pipeline.id, total ? { pipeline: moveTo } : undefined)
    )
    if (failed) return setError(failed)
    onDeleted(moveTo || pipelines.find((p) => p.id !== pipeline!.pipeline.id)?.id || '')
  }

  const invalid =
    !name.trim() ||
    !stages.length ||
    stages.some((s) => !s.name.trim()) ||
    !stages.some((s) => s.kind === 'open')

  return (
    <Modal
      open
      title={pipeline ? 'Editar pipeline' : 'Nuevo pipeline'}
      onClose={onClose}
      size="md"
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button kind="primary" onClick={() => void save()} disabled={invalid || saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="text-micro font-medium text-ob-muted">Nombre</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Outbound, Inbound, Oferta contratistas…"
          className="mt-1.5 h-8 w-full px-2.5 text-[14px] rounded-[4px] border border-ob-border bg-ob-bg text-ob-text outline-none placeholder:text-ob-faint focus:border-ob-accent"
        />
      </label>

      <h3 className="mt-5 mb-2 text-micro font-medium text-ob-muted">
        Columnas · arrastra para ordenar
      </h3>
      <ul className="flex flex-col gap-1" {...drag.zone('stages', stages.length)}>
        {stages.map((s, i) => {
          const item = drag.item(s.key, i, 'stages')
          return (
            <li
              key={s.key}
              {...item}
              draggable={grab === s.key}
              onDragEnd={(e) => {
                item.onDragEnd?.(e)
                setGrab(null)
              }}
              className={`flex items-center gap-2 rounded-[4px] border border-ob-border bg-ob-bg py-1 pr-1 pl-1 ${drag.dragging === s.key ? 'opacity-40' : ''} ${
                drag.target?.index === i && drag.dragging
                  ? 'shadow-[0_-3px_0_0_var(--color-ob-accent)]'
                  : ''
              }`}
            >
              <span
                className="grid h-[30px] w-6 shrink-0 cursor-grab place-items-center text-ob-muted hover:text-ob-text"
                onPointerDown={() => setGrab(s.key)}
                onPointerUp={() => setGrab(null)}
                aria-hidden
              >
                <GripVertical size={16} />
              </span>
              <input
                value={s.name}
                onChange={(e) => patch(s.key, { name: e.target.value })}
                maxLength={60}
                aria-label={`Nombre de la columna ${i + 1}`}
                className="h-[30px] min-w-0 flex-1 rounded-sm bg-transparent px-2 text-list outline-none hover:bg-ob-alt focus:bg-ob-alt"
              />
              <div
                role="radiogroup"
                aria-label="Tipo"
                className="flex shrink-0 rounded-[4px] bg-ob-alt p-0.5"
              >
                {STAGE_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={s.kind === k}
                    onClick={() => patch(s.key, { kind: k })}
                    className={`h-7 rounded-[4px] px-2.5 text-micro font-medium transition-colors ${
                      s.kind === k
                        ? k === 'won'
                          ? 'bg-ob-green/20 text-ob-green'
                          : 'bg-ob-hover text-ob-text'
                        : 'text-ob-muted hover:text-ob-text'
                    }`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <span
                className="w-8 shrink-0 text-center text-micro font-medium text-ob-muted tabular-nums"
                title="Prospectos"
              >
                {s.count || ''}
              </span>
              <IconButton
                label={`Borrar columna ${s.name}`}
                tone="danger"
                size="sm"
                onClick={() => remove(s)}
              >
                <Trash2 size={14} />
              </IconButton>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={() =>
          setStages((list) => [
            ...list,
            { id: '', key: key(), name: 'Nueva columna', kind: 'open', count: 0 }
          ])
        }
        className="mt-2 flex h-[30px] items-center gap-1.5 rounded-[4px] px-3 text-caption font-medium text-ob-muted transition-colors hover:bg-ob-hover hover:text-ob-text"
      >
        <Plus size={15} className="text-ob-link" />
        Añadir columna
      </button>

      {removed.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 rounded-[6px] border-l-2 border-ob-accent bg-ob-accent/10 px-3 py-2">
          {removed.map((s) => (
            <label
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-caption"
            >
              <span>
                Los {s.count} prospectos de «{s.name}» pasan a
              </span>
              <select
                value={moves[s.id] ?? ''}
                onChange={(e) => setMoves((m) => ({ ...m, [s.id]: e.target.value }))}
                className="h-8 rounded-[4px] bg-ob-active px-3 text-micro font-medium text-ob-text outline-none"
              >
                <option value="">Elige columna</option>
                {keptExisting.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <ErrorNote message={error} />

      {pipeline && pipelines.length > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-[6px] border-l-2 border-ob-red bg-ob-red/10 px-3 py-2 text-caption">
          <span className="min-w-0">
            Borrar este pipeline
            {total > 0 && (
              <>
                {' '}
                · sus {total} prospectos pasan a{' '}
                <select
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                  className="h-8 rounded-[4px] bg-ob-active px-3 text-micro font-medium text-ob-text outline-none"
                >
                  {pipelines
                    .filter((p) => p.id !== pipeline.pipeline.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </>
            )}
          </span>
          <ConfirmButton label="Borrar pipeline" onConfirm={() => void removePipeline()} />
        </div>
      )}
    </Modal>
  )
}
