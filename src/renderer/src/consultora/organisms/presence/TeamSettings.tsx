import { useEffect, useState } from 'react'
import { NOTIFY_DEFAULTS, NOTIFY_KINDS, NOTIFY_LABEL, type NotifySettings } from '@shared/activity'
import { Section } from '../../ui'
import { SettingRow, Toggle } from '../../molecules/SettingRow'
import { activityApi } from '../activity/useActivity'
import { presenceApi, usePresence } from './usePresence'

export function TeamSettings(): React.JSX.Element {
  const presence = usePresence()
  const [notify, setNotify] = useState<NotifySettings>(NOTIFY_DEFAULTS)

  useEffect(() => {
    let alive = true
    void activityApi.notifications().then((s) => alive && setNotify(s))
    return () => {
      alive = false
    }
  }, [])

  const toggle = (kind: keyof NotifySettings, on: boolean): void => {
    void activityApi.setNotifications({ ...notify, [kind]: on }).then(setNotify)
  }

  return (
    <Section title="Equipo">
      <SettingRow
        name="Mostrar que estoy conectado"
        description="Los demás ven tus iniciales y qué ficha tienes abierta."
      >
        <Toggle
          label="Mostrar que estoy conectado"
          checked={!presence.hidden}
          onChange={(on) => void presenceApi.setHidden(!on)}
        />
      </SettingRow>
      {NOTIFY_KINDS.map((kind) => (
        <SettingRow
          key={kind}
          name={`Avisos de ${NOTIFY_LABEL[kind].toLowerCase()}`}
          description="Un aviso del sistema cuando alguien te asigna una."
        >
          <Toggle
            label={`Avisos de ${NOTIFY_LABEL[kind].toLowerCase()}`}
            checked={notify[kind]}
            onChange={(on) => toggle(kind, on)}
          />
        </SettingRow>
      ))}
    </Section>
  )
}
