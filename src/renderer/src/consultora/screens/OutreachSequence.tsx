import { useCallback, useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { OutreachSequenceDetail } from '@shared/marketing'
import { attempt, type Go } from '../lib'
import { ErrorNote, Page } from '../ui'
import { htmlText } from '../../lib/email-html'
import {
  SequenceEditor,
  emptyStep,
  type SequenceDraftValue
} from '../organisms/email/SequenceEditor'
import { SequenceViewer } from '../organisms/email/SequenceViewer'

const marketing = window.api.marketing

const draftOf = (s: OutreachSequenceDetail): SequenceDraftValue => ({
  name: s.name,
  steps: s.steps.map(({ id, touchId, templateId, wait, subject, html, thread }) => ({
    id,
    touchId,
    templateId,
    wait,
    subject,
    html,
    thread
  }))
})

function problem(draft: SequenceDraftValue): string | null {
  if (!draft.name.trim()) return 'Ponle nombre a la secuencia.'
  if (!draft.steps.length) return 'La secuencia necesita al menos un email.'
  if (!draft.steps[0].subject.trim()) return 'El primer email necesita asunto.'
  const empty = draft.steps.findIndex((s) => !htmlText(s.html))
  if (empty >= 0) return `El email ${empty + 1} no tiene contenido.`
  return null
}

export function OutreachSequence({ id, go }: { id: string | null; go: Go }): React.JSX.Element {
  const [sequence, setSequence] = useState<OutreachSequenceDetail | null>(null)
  const [draft, setDraft] = useState<SequenceDraftValue | null>(
    id ? null : { name: '', steps: [emptyStep(true)] }
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    if (!id) return
    try {
      setSequence(await marketing.getOutreachSequence(id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState solo tras await (async)
    void load()
  }, [load])

  const save = async (): Promise<void> => {
    if (!draft) return
    const issue = problem(draft)
    if (issue) return setError(issue)
    setBusy(true)
    let savedId: string | null = null
    const failed = await attempt(async () => {
      const saved = await marketing.saveOutreachSequence({
        ...(id ? { id } : {}),
        name: draft.name.trim(),
        emails: draft.steps
      })
      savedId = saved.id
    })
    setBusy(false)
    setError(failed)
    if (failed || !savedId) return
    if (!id) return go({ name: 'outreach-sequence', id: savedId })
    setDraft(null)
    await load()
  }

  const archive = async (): Promise<void> => {
    if (!id) return
    setBusy(true)
    const failed = await attempt(() => marketing.archiveOutreachSequence(id, true))
    setBusy(false)
    if (failed) return setError(failed)
    go({ name: 'outreach' })
  }

  const title = id ? (sequence?.name ?? 'Secuencia') : 'Nueva secuencia'

  return (
    <Page
      variant="document"
      title={title}
      meta={
        <span>Secuencia de outreach en frío. Se envía desde los buzones conectados en Apollo.</span>
      }
      actions={
        sequence ? (
          <a
            href={sequence.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-[30px] items-center gap-1.5 rounded-[4px] bg-ob-active px-3 text-[13px] font-medium text-ob-text hover:bg-[#3f3f3f]"
          >
            <ExternalLink size={15} />
            Abrir en Apollo
          </a>
        ) : undefined
      }
    >
      <ErrorNote message={error} />
      {draft ? (
        <SequenceEditor
          value={draft}
          onChange={setDraft}
          onSave={() => void save()}
          onCancel={() => (id ? setDraft(null) : go({ name: 'outreach' }))}
          saving={busy}
          warning={
            sequence?.enabled
              ? 'Esta secuencia está activa. Los cambios afectan a quienes ya van a medio camino.'
              : null
          }
        />
      ) : (
        sequence && (
          <SequenceViewer
            sequence={sequence}
            busy={busy}
            onEdit={() => setDraft(draftOf(sequence))}
            onArchive={() => void archive()}
          />
        )
      )}
    </Page>
  )
}
