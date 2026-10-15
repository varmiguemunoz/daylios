import { useCallback, useEffect, useState } from 'react'
import type { AppInfo, UpdateState } from '@shared/app'
import { Button, ErrorNote, Section } from '../ui'
import { attempt, useLoad } from '../lib'
import { SettingRow, Toggle } from '../molecules/SettingRow'

const app = window.api.app

function updateText(state: UpdateState): string {
  switch (state.status) {
    case 'disabled':
      return 'Las actualizaciones automáticas solo funcionan en la app instalada.'
    case 'checking':
      return 'Buscando actualizaciones…'
    case 'none':
      return 'Tienes la última versión.'
    case 'downloading':
      return `Descargando la versión ${state.version}, ${state.percent} %.`
    case 'ready':
      return `La versión ${state.version} está lista para instalar.`
    case 'error':
      return `No pude comprobar actualizaciones: ${state.message}`
    default:
      return 'Se comprueba al abrir la app y cada 6 horas.'
  }
}

export function AppSettings(): React.JSX.Element {
  const load = useCallback(() => app.info(), [])
  const { data } = useLoad(load)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [update, setUpdate] = useState<UpdateState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => app.onUpdate(setUpdate), [])

  const current = info ?? data
  if (!current) return <Section title="Aplicación">{null}</Section>
  const state = update ?? current.update

  const run = async (task: () => Promise<AppInfo>): Promise<void> => {
    setBusy(true)
    setError(await attempt(async () => setInfo(await task())))
    setBusy(false)
  }

  return (
    <Section title="Aplicación">
      <SettingRow name={`Alisuite ${current.version}`} description={updateText(state)}>
        {state.status === 'ready' ? (
          <Button kind="primary" onClick={() => void app.installUpdate()}>
            Reiniciar y actualizar
          </Button>
        ) : (
          <Button
            disabled={state.status === 'disabled' || state.status === 'checking'}
            onClick={() => void app.checkUpdates().then(setUpdate)}
          >
            Buscar actualizaciones
          </Button>
        )}
      </SettingRow>
      <SettingRow
        name="Abrir al iniciar sesión"
        description="Alisuite arranca sola y queda en la bandeja."
      >
        <Toggle
          label="Abrir al iniciar sesión"
          checked={current.openAtLogin}
          onChange={(on) => void run(() => app.setOpenAtLogin(on))}
        />
      </SettingRow>
      <SettingRow
        name="Conectar con Claude"
        description={
          current.claudeLinked
            ? 'Claude Desktop ya usa Alisuite. Si moviste la app, vuelve a conectar.'
            : 'Añade Alisuite a Claude Desktop. Después cierra Claude del todo y vuelve a abrirlo.'
        }
      >
        <Button disabled={busy} onClick={() => void run(() => app.connectClaude())}>
          {current.claudeLinked ? 'Volver a conectar' : 'Conectar'}
        </Button>
      </SettingRow>
      <ErrorNote message={error} />
    </Section>
  )
}
