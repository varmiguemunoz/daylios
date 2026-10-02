import { useCallback, useState } from 'react'
import type { SettingsInput } from '@shared/consultora'
import { api, attempt, useLoad } from '../lib'
import { Button, ErrorNote, Field, Section } from '../ui'

const input = 'bg-transparent text-list outline-none placeholder:text-milk-soft'

/** Hub: el Worker de Cloudflare que recibe leads con el Mac apagado. URL y token de administración. */
export function HubSettings(): React.JSX.Element {
  const load = useCallback(() => api.settings(), [])
  const { data: settings } = useLoad(load)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)

  const save = async (patch: SettingsInput): Promise<boolean> => {
    const failed = await attempt(() => api.saveSettings(patch))
    setError(failed)
    setTest(null)
    return !failed
  }
  const probe = async (): Promise<void> => setTest(await window.api.marketing.testHub())

  if (!settings) return <Section title="Hub de leads">{null}</Section>

  return (
    <Section title="Hub de leads">
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="URL del Worker">
            <input
              key={`hub-${settings.hubUrl}`}
              defaultValue={settings.hubUrl}
              placeholder="https://leads-hub.tu-cuenta.workers.dev"
              onBlur={(e) =>
                e.target.value.trim() !== settings.hubUrl && void save({ hubUrl: e.target.value })
              }
              spellCheck={false}
              className={input}
            />
          </Field>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (token.trim())
                void save({ hubAdminToken: token }).then((ok) => ok && (setToken(''), void probe()))
            }}
          >
            <Field
              label={
                settings.hasHubToken
                  ? `Token de administración · guardado (${settings.hubTokenHint})`
                  : 'Token de administración · falta'
              }
            >
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onBlur={() =>
                  token.trim() &&
                  void save({ hubAdminToken: token }).then((ok) => ok && setToken(''))
                }
                placeholder={
                  settings.hasHubToken ? 'Pega otro para reemplazarlo' : 'El ADMIN_TOKEN del Worker'
                }
                autoComplete="off"
                spellCheck={false}
                className={input}
              />
            </Field>
          </form>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => void probe()} disabled={!settings.hubUrl || !settings.hasHubToken}>
            Probar conexión
          </Button>
          {settings.hasHubToken && (
            <Button kind="danger" onClick={() => void save({ hubAdminToken: '' })}>
              Quitar token
            </Button>
          )}
        </div>
        {test && (
          <p
            className={`rounded-md px-4 py-3 text-caption ${test.ok ? 'bg-mint/15 text-mint' : 'bg-coral/12 text-coral'}`}
          >
            {test.message}
          </p>
        )}
        <p className="px-1 text-caption text-milk-soft">
          El hub recibe los leads aunque este Mac esté apagado; la app los descarga cada minuto
          mientras está abierta. Cómo desplegarlo: workers/leads-hub en el README.
        </p>
      </div>
      <ErrorNote message={error} />
    </Section>
  )
}
