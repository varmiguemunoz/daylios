import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Cloud,
  CloudOff,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw
} from 'lucide-react'
import type { SyncPhase, SyncStatus } from '@shared/sync-protocol'
import { useOverlay } from '../../../ui/organisms/overlay'
import { dateTime } from '../../lib'
import { Button } from '../../ui'
import { syncApi, useSync } from './useSync'

const LABEL: Record<SyncPhase, string> = {
  off: 'Sin sincronizar',
  synced: 'Sincronizado',
  syncing: 'Sincronizando',
  offline: 'Sin conexión',
  paused: 'Pausado',
  error: 'Error al sincronizar'
}

const TABLE_LABEL: Record<string, string> = {
  clients: 'Cliente',
  projects: 'Proyecto',
  meetings: 'Reunión',
  prospects: 'Prospecto',
  pipelines: 'Pipeline',
  pipeline_stages: 'Etapa',
  contacts: 'Contacto',
  tags: 'Tag',
  lead_sources: 'Fuente',
  rules: 'Regla',
  tasks: 'Tarea'
}

function Icon({ status }: { status: SyncStatus }): React.JSX.Element {
  switch (status.phase) {
    case 'syncing':
      return <Loader2 size={15} className="animate-spin" />
    case 'offline':
      return <CloudOff size={15} />
    case 'paused':
      return <Pause size={15} />
    case 'error':
      return <AlertTriangle size={15} className="text-ob-yellow" />
    default:
      return <Cloud size={15} />
  }
}

export function SyncIndicator(): React.JSX.Element | null {
  const status = useSync()
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<DOMRect | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useOverlay(open, () => setOpen(false), panel)
  if (status.phase === 'off') return null

  const dot = status.deletedByOthers.length > 0

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={`${LABEL[status.phase]}. Ver detalle`}
        title={LABEL[status.phase]}
        onClick={() => {
          setBox(anchor.current?.getBoundingClientRect() ?? null)
          setOpen((v) => !v)
        }}
        className="relative grid size-7 place-items-center rounded-[4px] text-ob-muted transition-colors hover:bg-ob-hover hover:text-ob-text"
      >
        <Icon status={status} />
        {(dot || status.pending > 0) && (
          <span
            aria-hidden
            className={`absolute top-1 right-1 size-1.5 rounded-full ${dot ? 'bg-ob-yellow' : 'bg-ob-accent'}`}
          />
        )}
      </button>
      {open &&
        box &&
        createPortal(
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
            <div
              ref={panel}
              role="dialog"
              aria-label="Sincronización"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              style={{ top: box.bottom + 6, right: Math.max(8, window.innerWidth - box.right) }}
              className="absolute w-[300px] rounded-[8px] border border-ob-border bg-ob-alt p-4 text-[13px] text-ob-muted outline-none [-webkit-app-region:no-drag]"
            >
              <p className="flex items-center gap-2 text-[14px] font-semibold text-ob-text">
                <Icon status={status} />
                {LABEL[status.phase]}
              </p>
              {status.bootstrap && (
                <div className="mt-3">
                  <p>
                    Descargando {status.bootstrap.done} de {status.bootstrap.total}
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-ob-active">
                    <div
                      className="h-full rounded-full bg-ob-accent"
                      style={{
                        width: `${status.bootstrap.total ? (status.bootstrap.done / status.bootstrap.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              )}
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>En cola</dt>
                <dd className="text-right text-ob-text tabular-nums">{status.pending}</dd>
                <dt>Último envío</dt>
                <dd className="text-right text-ob-text">
                  {status.lastPushAt ? dateTime(status.lastPushAt) : 'Aún no'}
                </dd>
              </dl>
              {status.error && <p className="mt-3 text-ob-yellow">{status.error}</p>}
              {status.deletedByOthers.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-[12px] font-medium text-ob-faint">
                    Borrado por otra persona
                  </p>
                  <ul className="flex flex-col gap-1">
                    {status.deletedByOthers.map((d) => (
                      <li
                        key={`${d.entity}:${d.id}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate text-ob-text">
                          {TABLE_LABEL[d.entity] ?? d.entity}
                        </span>
                        <button
                          type="button"
                          onClick={() => void syncApi.restore(d.entity, d.id)}
                          className="flex items-center gap-1 text-ob-link transition-colors hover:text-ob-text"
                        >
                          <RotateCcw size={12} />
                          Restaurar
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void syncApi.syncNow()} disabled={status.phase === 'paused'}>
                  <RefreshCw size={13} />
                  Sincronizar ahora
                </Button>
                <Button onClick={() => void syncApi.pause(status.phase !== 'paused')}>
                  {status.phase === 'paused' ? <Play size={13} /> : <Pause size={13} />}
                  {status.phase === 'paused' ? 'Reanudar' : 'Pausar'}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => void syncApi.redownload()}
                className="mt-3 text-[12px] text-ob-faint transition-colors hover:text-ob-text"
              >
                Volver a descargar todo
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
