import { useCallback, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { attempt, useLoad, type Go } from '../lib'
import { Button, Empty, ErrorNote, List, Page } from '../ui'
import { OutreachSequenceRow } from '../molecules/OutreachSequenceRow'
import { OutreachSummary } from '../organisms/email/OutreachSummary'

const marketing = window.api.marketing

export function Outreach({ go }: { go: Go }): React.JSX.Element {
  const statusLoad = useCallback(() => marketing.outreachStatus(), [])
  const { data: status, reload: reloadStatus } = useLoad(statusLoad)
  const listLoad = useCallback(() => marketing.listOutreachSequences(), [])
  const { data, error: loadError, reload } = useLoad(listLoad)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const toggle = async (id: string, enabled: boolean): Promise<void> => {
    setBusy(id)
    setError(await attempt(() => marketing.setOutreachSequenceStatus(id, enabled, enabled)))
    await reload()
    setBusy(null)
  }

  const poll = async (): Promise<void> => {
    setBusy('poll')
    setError(await attempt(() => marketing.pollOutreach()))
    await reloadStatus()
    setBusy(null)
  }

  const ready = Boolean(status?.provider && status.configured)

  return (
    <Page
      title="Outreach"
      meta={
        <span>
          Secuencias en frío para prospectos. Las respuestas con interés se vuelven tareas y las
          bajas se respetan en todo el email.
        </span>
      }
      actions={
        ready ? (
          <Button onClick={() => void poll()} disabled={busy === 'poll'}>
            <RefreshCw
              size={15}
              className={busy === 'poll' ? 'animate-spin motion-reduce:animate-none' : ''}
            />
            Traer respuestas
          </Button>
        ) : undefined
      }
    >
      {status && !ready && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-[6px] border-l-2 border-ob-accent bg-ob-accent/10 px-3 py-2 text-caption text-ob-link">
          <span>
            {status.provider
              ? `Falta la API key de ${status.label}.`
              : 'Asigna un proveedor de outreach, como Apollo, en Ajustes, Email.'}
          </span>
          <Button kind="primary" onClick={() => go({ name: 'settings' })}>
            Ir a Ajustes
          </Button>
        </div>
      )}
      {status && ready && !status.hasFooter && (
        <p className="mt-6 rounded-[6px] border-l-2 border-ob-red bg-ob-red/10 px-3 py-2 text-caption text-ob-red">
          Falta el pie legal con tu dirección física. Sin él no se pueden crear secuencias.
        </p>
      )}
      {status && <OutreachSummary status={status} />}
      <ErrorNote message={error ?? (ready ? loadError : null) ?? status?.lastError ?? null} />

      {ready && (
        <div className="mt-6">
          {data?.length === 0 && (
            <Empty
              title="Aún no hay secuencias de outreach."
              hint="Pídesela a Claude: «crea una secuencia de 4 correos para contratistas de techos» y luego «inscribe a estos contactos»."
            />
          )}
          {data && data.length > 0 && (
            <List>
              {data.map((s) => (
                <OutreachSequenceRow
                  key={s.id}
                  sequence={s}
                  busy={busy === s.id}
                  onToggle={(enabled) => void toggle(s.id, enabled)}
                />
              ))}
            </List>
          )}
        </div>
      )}
    </Page>
  )
}
