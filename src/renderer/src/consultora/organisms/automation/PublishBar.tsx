import { useState } from 'react'
import { AlertCircle, FlaskConical, History, Pause, Play, Rocket, Zap } from 'lucide-react'
import type { AutomationStatus } from '@shared/automations'
import { Modal } from '../../../ui'
import { Button } from '../../ui'
import { AutomationStatusPill } from '../../molecules/automation/StatusPills'

export interface PublishBarProps {
  status: AutomationStatus
  versionNumber: number | null
  issues: number
  hasDraftChanges: boolean
  saving: boolean
  destructive: boolean
  onPublish: (acknowledgeDestructive: boolean) => void
  onToggle: () => void
  onIssues: () => void
  onVersions: () => void
  onTest: () => void
  onRun: () => void
}

export function PublishBar(p: PublishBarProps): React.JSX.Element {
  const [confirm, setConfirm] = useState(false)
  const [ack, setAck] = useState(false)
  const publishable = p.issues === 0 && (p.hasDraftChanges || p.versionNumber === null)
  const publish = (): void => {
    if (p.destructive) {
      setAck(false)
      setConfirm(true)
    } else p.onPublish(false)
  }
  const live = p.status === 'active'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AutomationStatusPill status={p.status} />
      <span className="text-[12px] text-ob-faint tabular-nums">
        {p.versionNumber ? `v${p.versionNumber}` : 'Sin publicar'}
        {' · '}
        {p.saving ? 'Guardando…' : p.hasDraftChanges ? 'Borrador con cambios' : 'Al día'}
      </span>
      <span className="w-2" />
      <Button onClick={p.onTest}>
        <FlaskConical size={14} aria-hidden />
        Probar
      </Button>
      <Button
        onClick={p.onRun}
        disabled={!live}
        title={live ? undefined : 'Actívala para ejecutarla a mano'}
      >
        <Zap size={14} aria-hidden />
        Ejecutar
      </Button>
      <Button onClick={p.onVersions} title="Versiones">
        <History size={14} aria-hidden />
      </Button>
      {p.versionNumber !== null && (
        <Button onClick={p.onToggle}>
          {live ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
          {live ? 'Pausar' : p.status === 'locked' ? 'Desbloquear' : 'Activar'}
        </Button>
      )}
      {p.issues > 0 && (
        <button
          type="button"
          onClick={p.onIssues}
          className="flex h-[30px] items-center gap-1 rounded-[4px] px-2 text-[13px] font-medium text-ob-orange hover:bg-ob-orange/10"
        >
          <AlertCircle size={14} aria-hidden />
          {p.issues} {p.issues === 1 ? 'error' : 'errores'}
        </button>
      )}
      {(publishable || p.issues > 0) && (
        <Button
          kind="primary"
          onClick={publish}
          disabled={!publishable}
          title={p.issues ? 'Corrige los errores para publicar' : undefined}
        >
          <Rocket size={14} aria-hidden />
          Publicar
        </Button>
      )}
      <Modal
        open={confirm}
        title="Publicar una automatización que borra"
        onClose={() => setConfirm(false)}
        size="sm"
        actions={
          <Button
            kind="danger"
            disabled={!ack}
            onClick={() => {
              setConfirm(false)
              p.onPublish(true)
            }}
          >
            Publicar
          </Button>
        }
      >
        <p className="text-[13px] text-ob-muted">
          Algún paso borra contactos o prospectos. Lo borrado va a la papelera, pero corre solo,
          sobre cada sujeto que entre.
        </p>
        <label className="mt-3 flex items-center gap-2 text-[13px] text-ob-text">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="size-4 accent-[var(--color-ob-red)]"
          />
          Entiendo que borra registros
        </label>
      </Modal>
    </div>
  )
}
