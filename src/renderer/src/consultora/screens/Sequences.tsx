import { useCallback, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { attempt, useLoad, type Go } from '../lib'
import { Button, Empty, ErrorNote, List, Page, Pill, Row } from '../ui'

const marketing = window.api.marketing

/**
 * Secuencias = Automations de Resend. Corren en Resend aunque el Mac esté apagado.
 * Aquí se ven y se activan o pausan; se crean en el dashboard de Resend o pidiéndoselo a Claude.
 */
export function Sequences({ go }: { go: Go }): React.JSX.Element {
  const load = useCallback(() => marketing.listSequences(), [])
  const { data, error: loadError, reload } = useLoad(load)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const toggle = async (id: string, enabled: boolean): Promise<void> => {
    setBusy(id)
    setError(await attempt(() => marketing.setSequenceStatus(id, enabled)))
    await reload()
    setBusy(null)
  }

  const noKey = loadError?.includes('API key')

  return (
    <Page
      title="Secuencias"
      meta={
        <span>
          Emails en cadena que Resend envía cuando ocurre un evento: un lead nuevo, un tag, una
          regla.
        </span>
      }
      actions={
        <a
          href="https://resend.com/automations"
          target="_blank"
          rel="noreferrer"
          className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-caption font-extrabold text-milk hover:bg-surface-raised"
        >
          <ExternalLink size={15} />
          Abrir Resend
        </a>
      }
    >
      {noKey ? (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-md bg-apricot/10 px-5 py-3 text-caption text-apricot">
          <span>Conecta Resend para ver y crear secuencias.</span>
          <Button kind="primary" onClick={() => go({ name: 'settings' })}>
            Ir a Ajustes
          </Button>
        </div>
      ) : (
        <ErrorNote message={error ?? loadError} />
      )}

      <div className="mt-6">
        {data?.length === 0 && (
          <Empty
            title="Aún no hay secuencias."
            hint="Créala en Resend o pídesela a Claude: «crea una secuencia de 3 emails para quien entre en el tag webinar»."
          />
        )}
        {data && data.length > 0 && (
          <List>
            {data.map((s) => (
              <Row key={s.id}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-list font-bold">{s.name}</span>
                  <span className="block truncate text-caption text-milk-soft">
                    {s.event ? (
                      <>
                        Al recibir <span className="font-mono text-micro text-milk">{s.event}</span>
                      </>
                    ) : (
                      'Sin evento'
                    )}
                    {' · '}
                    {s.emails} {s.emails === 1 ? 'email' : 'emails'}
                  </span>
                </span>
                <Pill tone={s.status === 'enabled' ? 'mint' : 'neutral'}>
                  {s.status === 'enabled' ? 'Activa' : 'Pausada'}
                </Pill>
                <Button
                  onClick={() => void toggle(s.id, s.status !== 'enabled')}
                  disabled={busy === s.id}
                >
                  {s.status === 'enabled' ? 'Pausar' : 'Activar'}
                </Button>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir ${s.name} en Resend`}
                  title="Abrir en Resend"
                  className="grid size-9 shrink-0 place-items-center rounded-full text-milk-soft hover:bg-hairline hover:text-milk"
                >
                  <ExternalLink size={15} />
                </a>
              </Row>
            ))}
          </List>
        )}
      </div>
    </Page>
  )
}
