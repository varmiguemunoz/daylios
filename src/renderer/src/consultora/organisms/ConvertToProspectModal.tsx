import { useEffect, useState } from 'react'
import type { PipelineSummary, Stage } from '@shared/consultora'
import { api, attempt } from '../lib'
import { Button, ErrorNote, Modal, Select } from '../ui'
import { Chips } from '../marketing-ui'

interface ConvertToProspectModalProps {
  open: boolean
  contactId: string
  /** Nombre propuesto para el prospecto (cliente, empresa del formulario o el contacto). */
  defaultCompany: string
  onClose: () => void
  onDone: (prospectId: string) => void
}

/** «Convertir en prospecto»: pipeline, etapa abierta, nombre y valor. */
export function ConvertToProspectModal({
  open,
  contactId,
  defaultCompany,
  onClose,
  onDone
}: ConvertToProspectModalProps): React.JSX.Element | null {
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [pipeline, setPipeline] = useState('')
  const [stage, setStage] = useState('')
  const [company, setCompany] = useState(defaultCompany)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    api
      .listPipelines()
      .then((list) => {
        setPipelines(list)
        setPipeline((p) => p || list[0]?.id || '')
      })
      .catch(() => undefined)
  }, [open])

  useEffect(() => {
    if (!open || !pipeline) return
    api
      .listStages(pipeline)
      .then((list) => {
        const openStages = list.filter((s) => s.kind === 'open')
        setStages(openStages)
        setStage(openStages[0]?.id ?? '')
      })
      .catch(() => undefined)
  }, [open, pipeline])

  const create = async (): Promise<void> => {
    let prospectId = ''
    const failed = await attempt(async () => {
      const r = await api.convertContact(contactId, {
        pipeline: pipeline || undefined,
        stage: stage || undefined,
        company: company.trim() || undefined,
        valueUsd: value.trim() ? Number(value) : null
      })
      prospectId = r.prospect.id
    })
    if (failed) return setError(failed)
    onDone(prospectId)
  }

  return (
    <Modal
      open={open}
      title="Convertir en prospecto"
      onClose={onClose}
      size="sm"
      actions={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button kind="primary" onClick={() => void create()} disabled={!company.trim() || !stage}>
            Crear prospecto
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {pipelines.length > 1 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-micro font-medium text-ob-muted">Pipeline</span>
            <Select
              label="Pipeline"
              value={pipeline}
              options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
              onChange={setPipeline}
            />
          </label>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-micro font-medium text-ob-muted">Etapa</span>
          <div className="[&>div]:flex-wrap">
            <Chips
              label="Etapa"
              value={stage}
              options={stages.map((s) => ({ id: s.id, label: s.name }))}
              onChange={setStage}
            />
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-micro font-medium text-ob-muted">Nombre del prospecto</span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="h-8 px-2.5 text-[14px] rounded-[4px] border border-ob-border bg-ob-bg text-ob-text outline-none placeholder:text-ob-faint focus:border-ob-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-micro font-medium text-ob-muted">
            Valor estimado (USD, opcional)
          </span>
          <input
            type="number"
            min={0}
            step={500}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="5000"
            className="h-8 px-2.5 text-[14px] tabular-nums rounded-[4px] border border-ob-border bg-ob-bg text-ob-text outline-none placeholder:text-ob-faint focus:border-ob-accent"
          />
        </label>
        <ErrorNote message={error} />
      </div>
    </Modal>
  )
}
