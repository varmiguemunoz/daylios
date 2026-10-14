import { useCallback, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { Settings, SettingsInput } from '@shared/consultora'
import { api, attempt, dateTime, useLoad } from '../lib'
import { Button, ErrorNote, Field, Section } from '../ui'

const marketing = window.api.marketing
const input = 'bg-transparent text-[14px] text-ob-text outline-none placeholder:text-ob-faint'

export function EmailSettings(): React.JSX.Element {
  const load = useCallback(() => api.settings(), [])
  const { data: settings } = useLoad(load)
  const statusLoad = useCallback(() => marketing.status(), [])
  const { data: status, reload: reloadStatus } = useLoad(statusLoad)
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  const save = async (patch: SettingsInput): Promise<boolean> => {
    const failed = await attempt(() => api.saveSettings(patch))
    setError(failed)
    setTest(null)
    return !failed
  }

  const saveKey = async (): Promise<void> => {
    if (await save({ resendApiKey: key })) {
      setKey('')
      setTest(await marketing.testResend())
    }
  }

  const syncNow = async (): Promise<void> => {
    setSyncing(true)
    setError(await attempt(() => marketing.syncNow()))
    await reloadStatus()
    setSyncing(false)
  }

  if (!settings) return <Section title="Resend">{null}</Section>

  const text = (
    field: keyof Settings & keyof SettingsInput,
    label: string,
    placeholder: string
  ): React.JSX.Element => (
    <Field label={label}>
      <input
        key={`${field}-${String(settings[field])}`}
        defaultValue={String(settings[field] ?? '')}
        placeholder={placeholder}
        onBlur={(e) => e.target.value !== settings[field] && void save({ [field]: e.target.value })}
        spellCheck={false}
        className={input}
      />
    </Field>
  )

  return (
    <Section title="Resend">
      <div className="flex flex-col gap-2">
        <form
          className="flex items-stretch gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (key.trim()) void saveKey()
          }}
        >
          <div className="min-w-0 flex-1">
            <Field
              label={
                settings.hasResendKey
                  ? `API key · guardada (${settings.resendKeyHint})`
                  : 'API key · falta'
              }
            >
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={settings.hasResendKey ? 'Pega otra para reemplazarla' : 're_…'}
                autoComplete="off"
                spellCheck={false}
                className={input}
              />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button kind="primary" disabled={!key.trim()} onClick={() => void saveKey()}>
              Guardar
            </Button>
            {settings.hasResendKey && (
              <>
                <Button onClick={() => void marketing.testResend().then(setTest)}>Probar</Button>
                <Button kind="danger" onClick={() => void save({ resendApiKey: '' })}>
                  Quitar
                </Button>
              </>
            )}
          </div>
        </form>

        {test && (
          <p
            className={`rounded-[6px] border-l-2 px-3 py-2 text-[13px] ${test.ok ? 'border-ob-green bg-ob-green/10 text-ob-green' : 'border-ob-red bg-ob-red/10 text-ob-red'}`}
          >
            {test.message}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {text('fromEmail', 'Remitente (dominio verificado)', 'hola@tudominio.com')}
          {text('fromName', 'Nombre del remitente', 'Ali Muñoz')}
          {text('replyTo', 'Responder a', 'Vacío = el remitente')}
          {text('ownerEmail', 'Tu email (copia de cada newsletter)', 'tu@email.com')}
        </div>

        {status && (
          <div className="flex items-center gap-3 rounded-[6px] border border-ob-border py-2 pr-2 pl-3">
            <p className="min-w-0 flex-1 text-caption text-ob-muted">
              {!status.resendConfigured
                ? 'Sin API key: los cambios esperan en la cola hasta que la pongas.'
                : status.pending === 0
                  ? 'Todo sincronizado con Resend.'
                  : `${status.pending} ${status.pending === 1 ? 'cambio pendiente' : 'cambios pendientes'}` +
                    (status.failing ? ` · ${status.failing} con error, se reintentan solos` : '')}
              {status.lastPullAt && ` · Hub: ${dateTime(status.lastPullAt)}`}
            </p>
            <Button onClick={() => void syncNow()} disabled={syncing}>
              <RefreshCw
                size={15}
                className={syncing ? 'animate-spin motion-reduce:animate-none' : ''}
              />
              Sincronizar ahora
            </Button>
          </div>
        )}
        {status?.lastError && status.failing > 0 && (
          <p className="rounded-[6px] border-l-2 border-ob-red bg-ob-red/10 px-3 py-2 text-caption text-ob-red">
            {status.lastError}
          </p>
        )}

        <p className="px-1 text-caption text-ob-muted">
          Crea la key en resend.com → API Keys (acceso completo). Las claves se guardan solo en este
          Mac, en settings.json con permisos de tu usuario.
        </p>
      </div>
      <ErrorNote message={error} />
    </Section>
  )
}
