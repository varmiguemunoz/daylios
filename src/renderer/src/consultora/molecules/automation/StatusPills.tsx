import type { AutomationStatus, RunStatus, StepStatus } from '@shared/automations'
import { Pill, type Tone } from '../../ui'

const AUTOMATION: Record<AutomationStatus, [Tone, string]> = {
  draft: ['neutral', 'Borrador'],
  active: ['mint', 'Activa'],
  paused: ['neutral', 'Pausada'],
  locked: ['coral', 'Bloqueada']
}

const RUN: Record<RunStatus, [Tone, string]> = {
  active: ['apricot', 'En curso'],
  waiting: ['butter', 'Esperando'],
  finished: ['mint', 'Terminada'],
  failed: ['coral', 'Falló'],
  cancelled: ['neutral', 'Cancelada']
}

const STEP: Record<StepStatus, [Tone, string]> = {
  ok: ['mint', 'Hecho'],
  skipped: ['neutral', 'Omitido'],
  waiting: ['butter', 'Esperando'],
  failed: ['coral', 'Falló'],
  retrying: ['orange', 'Reintentando']
}

export function AutomationStatusPill({ status }: { status: AutomationStatus }): React.JSX.Element {
  const [tone, label] = AUTOMATION[status]
  return <Pill tone={tone}>{label}</Pill>
}

export function RunStatusPill({
  status,
  late
}: {
  status: RunStatus
  late?: boolean
}): React.JSX.Element {
  const [tone, label] = RUN[status]
  return (
    <span className="flex items-center gap-1">
      <Pill tone={tone}>{label}</Pill>
      {late && <Pill tone="orange">Con retraso</Pill>}
    </span>
  )
}

export function StepStatusPill({ status }: { status: StepStatus }): React.JSX.Element {
  const [tone, label] = STEP[status]
  return <Pill tone={tone}>{label}</Pill>
}
