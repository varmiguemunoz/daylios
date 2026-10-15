import { useCallback, useState } from 'react'
import type { RunView, SubjectType } from '@shared/automations'
import { attempt, dateTime, type Go } from '../../lib'
import { Empty, ErrorNote, List, Row, Section, Select } from '../../ui'
import { RunStatusPill } from '../../molecules/automation/StatusPills'
import { useLiveLoad } from '../../hooks/useLiveLoad'
import { RunDrawer } from './RunDrawer'

const automations = window.api.automations

export function AutomationsSection({
  subject,
  subjectId,
  go
}: {
  subject: SubjectType
  subjectId: string
  go: Go
}): React.JSX.Element {
  const runsLoad = useCallback(() => automations.runs({ subjectId, limit: 20 }), [subjectId])
  const { data: runs } = useLiveLoad(runsLoad)
  const listLoad = useCallback(() => automations.list(), [])
  const { data: list } = useLiveLoad(listLoad)
  const [open, setOpen] = useState<RunView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const runnable = (list ?? []).filter((a) => a.subject === subject && a.status === 'active')

  const run = async (id: string): Promise<void> => {
    if (!id) return
    const failed = await attempt(() => automations.runManual(id, subjectId))
    setError(failed)
    setNotice(failed ? null : 'En cola. Aparece aquí en unos segundos.')
  }

  return (
    <Section
      title="Automatizaciones"
      aside={
        runnable.length > 0 && (
          <Select
            label="Ejecutar automatización"
            value=""
            onChange={(id) => void run(id)}
            options={[
              { value: '', label: 'Ejecutar automatización…' },
              ...runnable.map((a) => ({ value: a.id, label: a.name }))
            ]}
          />
        )
      }
    >
      <ErrorNote message={error} />
      {notice && <p className="mb-2 text-[12px] text-ob-muted">{notice}</p>}
      {runs && runs.length === 0 ? (
        <Empty title="No ha pasado por ninguna automatización." />
      ) : (
        <List>
          {(runs ?? []).map((r) => (
            <Row key={r.id} onClick={() => setOpen(r)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-list font-medium">{r.automationName}</span>
                <span className="block truncate text-caption text-ob-muted">
                  {r.nodeName ?? r.reason ?? ''}
                </span>
              </span>
              <RunStatusPill status={r.status} late={r.late} />
              <span className="w-32 shrink-0 text-right text-caption text-ob-muted">
                {dateTime(r.createdAt)}
              </span>
            </Row>
          ))}
        </List>
      )}
      <RunDrawer
        run={open}
        onClose={() => setOpen(null)}
        onShowPath={() => {
          if (open) go({ name: 'automation', id: open.automationId })
          setOpen(null)
        }}
      />
    </Section>
  )
}
