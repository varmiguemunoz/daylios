import { useCallback, useState } from 'react'
import { AlertCircle, Plus } from 'lucide-react'
import {
  SUBJECT_LABELS,
  SUBJECT_TYPES,
  TEMPLATES,
  type AutomationSummary,
  type SubjectType
} from '@shared/automations'
import { Modal } from '../../ui'
import { errorMessage } from '../../lib/api'
import { type Go } from '../lib'
import { Button, Empty, ErrorNote, INPUT, List, Page, Row, Select } from '../ui'
import { AutomationStatusPill } from '../molecules/automation/StatusPills'
import { useLiveLoad } from '../hooks/useLiveLoad'

const automations = window.api.automations

function Counts({ a }: { a: AutomationSummary }): React.JSX.Element {
  const c = a.counts
  return (
    <span className="hidden shrink-0 items-center gap-3 text-[12px] text-ob-muted tabular-nums @2xl:flex">
      <span title="En curso o esperando">{c.active + c.waiting} dentro</span>
      <span title="Terminadas">{c.finished} terminadas</span>
      {c.failed > 0 && (
        <span className={c.failedRecent ? 'text-ob-red' : ''} title="Fallidas">
          {c.failed} fallidas
        </span>
      )}
    </span>
  )
}

export function Automations({ go }: { go: Go }): React.JSX.Element {
  const load = useCallback(() => automations.list(), [])
  const { data, error: loadError } = useLiveLoad(load)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState<SubjectType>('contact')

  const create = async (): Promise<void> => {
    try {
      const { automation } = await automations.create({
        name: name.trim() || 'Nueva automatización',
        subject
      })
      setCreating(false)
      setName('')
      go({ name: 'automation', id: automation.id })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const fromTemplate = async (templateId: string): Promise<void> => {
    const t = TEMPLATES.find((x) => x.id === templateId)
    if (!t) return
    try {
      const { automation } = await automations.create({ name: t.name, subject: t.subject })
      await automations.saveDraft(automation.id, t.build())
      go({ name: 'automation', id: automation.id })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Page
      title="Automatizaciones"
      meta={<span>Flujos que corren solos cuando pasa algo: un tag, una etapa, una fecha.</span>}
      actions={
        <Button kind="primary" onClick={() => setCreating(true)}>
          <Plus size={15} aria-hidden />
          Nueva
        </Button>
      }
    >
      <ErrorNote message={error ?? loadError} />
      <div className="mt-6">
        {data && data.length > 0 && (
          <List>
            {data.map((a) => (
              <Row key={a.id} onClick={() => go({ name: 'automation', id: a.id })}>
                <span className={`min-w-0 flex-1 ${a.status === 'draft' ? 'opacity-60' : ''}`}>
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-ob-text">{a.name}</span>
                    {a.issues > 0 && (
                      <span
                        className="flex shrink-0 items-center gap-1 text-[12px] text-ob-orange"
                        title="Errores en el borrador"
                      >
                        <AlertCircle size={13} aria-hidden />
                        {a.issues}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[13px] text-ob-muted">{a.sentence}</span>
                </span>
                <Counts a={a} />
                <span className="w-16 shrink-0 text-right text-[12px] text-ob-faint tabular-nums">
                  {a.versionNumber ? `v${a.versionNumber}` : '—'}
                  {a.hasDraftChanges && a.versionNumber ? ' ·' : ''}
                </span>
                <AutomationStatusPill status={a.status} />
              </Row>
            ))}
          </List>
        )}
        {data && data.length === 0 && (
          <div>
            <Empty
              title="Aún no hay automatizaciones."
              hint="Empieza con un ejemplo o crea una desde cero."
            />
            <ul className="mx-auto grid max-w-[720px] gap-2 @2xl:grid-cols-3">
              {TEMPLATES.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => void fromTemplate(t.id)}
                    className="flex h-full w-full flex-col gap-1 rounded-[6px] border border-ob-border p-3 text-left transition-colors hover:border-ob-accent/60 hover:bg-ob-hover"
                  >
                    <span className="text-[13px] font-medium text-ob-text">{t.name}</span>
                    <span className="text-[12px] text-ob-muted">{t.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Modal
        open={creating}
        title="Nueva automatización"
        onClose={() => setCreating(false)}
        size="sm"
        actions={
          <Button kind="primary" onClick={() => void create()}>
            Crear
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ob-muted">
            Nombre
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void create()}
              placeholder="Bienvenida a leads del webinar"
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ob-muted">
            Sobre qué corre
            <Select
              label="Sujeto"
              value={subject}
              onChange={(v) => setSubject(v as SubjectType)}
              options={SUBJECT_TYPES.map((s) => ({ value: s, label: SUBJECT_LABELS[s] }))}
            />
          </label>
          <p className="text-[12px] text-ob-faint">
            El sujeto decide qué triggers, pasos y variables puedes usar. No se cambia después.
          </p>
        </div>
      </Modal>
    </Page>
  )
}
