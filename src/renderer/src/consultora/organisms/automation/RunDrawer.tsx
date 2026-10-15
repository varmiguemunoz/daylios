import { useCallback, useState } from 'react'
import { Route } from 'lucide-react'
import { nodeSpec, type RunView } from '@shared/automations'
import { Drawer } from '../../../ui'
import { dateTime, humanize } from '../../lib'
import { Button, ErrorNote } from '../../ui'
import { RunStatusPill, StepStatusPill } from '../../molecules/automation/StatusPills'
import { useLiveLoad } from '../../hooks/useLiveLoad'
import { RunActions } from './RunsTable'

const automations = window.api.automations
const NEEDS_SETUP = /no está configurado|Falta tu email/

export function RunDrawer({
  run,
  onClose,
  onShowPath,
  nameOf
}: {
  run: RunView | null
  onClose: () => void
  onShowPath?: (nodeIds: string[]) => void
  nameOf?: (nodeId: string) => string | undefined
}): React.JSX.Element {
  const id = run?.id ?? null
  const load = useCallback(() => (id ? automations.run(id) : Promise.resolve(null)), [id])
  const { data, error: loadError } = useLiveLoad(load)
  const [error, setError] = useState<string | null>(null)
  const current = data?.run ?? run

  return (
    <Drawer
      open={run !== null}
      title={current?.subjectLabel ?? current?.automationName ?? 'Ejecución'}
      onClose={onClose}
      footer={
        current && (
          <div className="flex w-full items-center gap-2">
            {onShowPath && data && (
              <Button onClick={() => onShowPath(data.steps.map((s) => s.nodeId))}>
                <Route size={14} aria-hidden />
                Ver en el lienzo
              </Button>
            )}
            <span className="flex-1" />
            <RunActions run={current} onDone={setError} />
          </div>
        )
      }
    >
      {current && (
        <div className="flex flex-col gap-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <RunStatusPill status={current.status} late={current.late} />
            <span className="text-ob-muted">Entró {dateTime(current.createdAt)}</span>
          </div>
          {current.reason && <p className="text-ob-muted">{humanize(current.reason)}</p>}
          {current.nextAt && (
            <p className="text-ob-muted">Próximo paso {dateTime(current.nextAt)}</p>
          )}
          <ErrorNote message={error ?? loadError} />
          <ol className="flex flex-col border-t border-ob-border">
            {(data?.steps ?? []).map((s) => (
              <li key={s.id} className="flex flex-col gap-1 border-b border-ob-border py-2">
                <span className="flex items-center gap-2">
                  <StepStatusPill status={s.status} />
                  <span className="min-w-0 flex-1 truncate text-ob-text">
                    {nameOf?.(s.nodeId) ?? nodeSpec(s.nodeType)?.label ?? s.nodeType}
                  </span>
                  {s.attempt > 1 && (
                    <span className="text-[12px] text-ob-muted">intento {s.attempt}</span>
                  )}
                </span>
                {s.message && (
                  <span
                    className={`text-[12px] ${s.status === 'skipped' && NEEDS_SETUP.test(s.message) ? 'text-ob-yellow' : 'text-ob-muted'}`}
                  >
                    {humanize(s.message)}
                    {s.status === 'skipped' &&
                      NEEDS_SETUP.test(s.message) &&
                      ' Configúralo en Ajustes, Email.'}
                  </span>
                )}
                <span className="text-[12px] text-ob-faint">{dateTime(s.startedAt)}</span>
                {s.output && Object.keys(s.output).length > 0 && (
                  <pre className="overflow-x-auto rounded-[4px] bg-ob-alt px-2 py-1.5 font-mono text-[12px] text-ob-muted">
                    {JSON.stringify(s.output, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Drawer>
  )
}
