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
            <span className="text-micro font-bold text-milk-soft">Pipeline</span>
            <Select
              label="Pipeline"
              value={pipeline}
              options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
              onChange={setPipeline}
            />
          </label>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-micro font-bold text-milk-soft">Etapa</span>
          <div className="[&>div]:flex-wrap">
            <Chips label="Etapa" value={stage} options={stages.map((s) => ({ id: s.id, label: s.name }))} onChange={setStage} />
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-micro font-bold text-milk-soft">Nombre del prospecto</span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="h-11 rounded-sm bg-night/60 px-4 text-list outline-none focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-micro font-bold text-milk-soft">Valor estimado (USD, opcional)</span>
          <input
            type="number"
            min={0}
            step={500}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="5000"
            className="h-11 rounded-sm bg-night/60 px-4 text-list tabular-nums outline-none placeholder:text-milk-soft focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
          />
        </label>
        <ErrorNote message={error} />
      </div>
    </Modal>
  )
}
