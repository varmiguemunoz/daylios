import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { nodeSpec, type Definition, type SubjectOption, type TestResult } from '@shared/automations'
import { Drawer } from '../../../ui'
import { attempt } from '../../lib'
import { Button, ErrorNote } from '../../ui'
import { NodeIcon } from '../../atoms/NodeIcon'
import { SubjectPicker } from '../../molecules/automation/SubjectPicker'

const automations = window.api.automations

export function TestDrawer({
  open,
  id,
  def,
  onClose
}: {
  open: boolean
  id: string
  def: Definition
  onClose: () => void
}): React.JSX.Element {
  const [subject, setSubject] = useState<SubjectOption | null>(null)
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const needsSubject = def.subject !== 'none'

  const run = async (): Promise<void> => {
    setResult(null)
    setError(
      await attempt(async () =>
        setResult(await automations.test({ id, definition: def, subjectId: subject?.id ?? null }))
      )
    )
  }

  return (
    <Drawer
      open={open}
      title="Probar"
      onClose={onClose}
      footer={
        <Button kind="primary" onClick={() => void run()} disabled={needsSubject && !subject}>
          <FlaskConical size={14} aria-hidden />
          Simular
        </Button>
      }
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <p className="text-[12px] text-ob-muted">
          Simula el borrador sobre un sujeto real sin escribir nada. Las esperas se dan por
          cumplidas.
        </p>
        {needsSubject && (
          <SubjectPicker subject={def.subject} value={subject} onChange={setSubject} />
        )}
        <ErrorNote message={error} />
        {result && (
          <div className="flex flex-col gap-2">
            {!result.matchedTrigger && (
              <p className="rounded-[4px] border-l-2 border-ob-yellow bg-ob-yellow/10 px-2.5 py-2 text-[12px] text-ob-yellow">
                Este sujeto no pasa los filtros de ningún trigger. Así se vería si entrara.
              </p>
            )}
            <ol className="flex flex-col gap-2">
              {result.steps.map((s, i) => (
                <li
                  key={`${s.nodeId}-${i}`}
                  className="flex flex-col gap-1 rounded-[6px] border border-ob-border p-2"
                >
                  <span className="flex items-center gap-2">
                    <NodeIcon
                      name={nodeSpec(s.type)?.icon ?? 'Circle'}
                      size={14}
                      className="shrink-0 text-ob-link"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-ob-text">
                      {s.name}
                    </span>
                  </span>
                  <span className="text-[12px] text-ob-muted">{s.sentence}</span>
                  {Object.entries(s.rendered).map(([label, value]) => (
                    <span key={label} className="text-[12px]">
                      <span className="text-ob-faint">{label}: </span>
                      <span className="whitespace-pre-wrap text-ob-text">{value || '—'}</span>
                    </span>
                  ))}
                  {s.note && <span className="text-[12px] text-ob-link">{s.note}</span>}
                </li>
              ))}
              {!result.steps.length && <li className="text-ob-faint">No hay pasos.</li>}
            </ol>
          </div>
        )}
      </div>
    </Drawer>
  )
}
