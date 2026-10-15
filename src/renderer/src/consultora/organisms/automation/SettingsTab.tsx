import {
  describeDefinition,
  SUBJECT_LABELS,
  WEEKDAYS,
  type Definition,
  type Names,
  type Settings
} from '@shared/automations'
import { ConfirmButton } from '../../../ui'
import { INPUT, Section } from '../../ui'
import { SettingRow, Toggle } from '../../molecules/SettingRow'

const DEFAULT_WINDOW = { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' }

export function SettingsTab({
  def,
  names,
  onChange,
  onDelete
}: {
  def: Definition
  names: Names
  onChange: (settings: Settings) => void
  onDelete: () => void
}): React.JSX.Element {
  const s = def.settings
  const w = s.window
  const set = (patch: Partial<Settings>): void => onChange({ ...s, ...patch })

  return (
    <div className="mx-auto max-w-[760px] px-6 pb-16">
      <Section title="Resumen">
        <p className="text-[14px] text-ob-text">{describeDefinition(def, names, 12)}</p>
        <p className="mt-1 text-[13px] text-ob-muted">
          Sujeto: {SUBJECT_LABELS[def.subject]}. No se puede cambiar.
        </p>
      </Section>
      <Section title="Entrada">
        <SettingRow
          name="Puede volver a entrar"
          description="Si sale, el mismo sujeto puede entrar de nuevo cuando vuelva a cumplirse un trigger. Nunca hay dos ejecuciones abiertas a la vez."
        >
          <Toggle
            label="Puede volver a entrar"
            checked={s.reentry === 'allow'}
            onChange={(on) => set({ reentry: on ? 'allow' : 'never' })}
          />
        </SettingRow>
      </Section>
      <Section title="Ventana horaria">
        <SettingRow
          name="Solo comunicar en horario"
          description="Los emails, notificaciones y webhooks esperan a la siguiente apertura. El resto de pasos corre a cualquier hora. Usa la zona horaria de este Mac."
        >
          <Toggle
            label="Usar ventana horaria"
            checked={w !== null}
            onChange={(on) => set({ window: on ? DEFAULT_WINDOW : null })}
          />
        </SettingRow>
        {w && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map((day, i) => {
                const on = w.days.includes(i)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set({
                        window: {
                          ...w,
                          days: on ? w.days.filter((d) => d !== i) : [...w.days, i].sort()
                        }
                      })
                    }
                    className={`h-[26px] rounded-[4px] px-2.5 text-[12px] font-medium ${on ? 'bg-ob-accent/20 text-ob-link' : 'bg-ob-active text-ob-muted hover:text-ob-text'}`}
                  >
                    {day.slice(0, 3)}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 text-[13px] text-ob-muted">
              De
              <input
                type="time"
                aria-label="Abre"
                value={w.start}
                onChange={(e) => set({ window: { ...w, start: e.target.value } })}
                className={`${INPUT} w-28`}
              />
              a
              <input
                type="time"
                aria-label="Cierra"
                value={w.end}
                onChange={(e) => set({ window: { ...w, end: e.target.value } })}
                className={`${INPUT} w-28`}
              />
            </div>
          </div>
        )}
      </Section>
      <Section title="Zona de peligro">
        <SettingRow
          name="Borrar automatización"
          description="Cancela las ejecuciones abiertas y la manda a la papelera."
        >
          <ConfirmButton
            label="Borrar automatización"
            size="sm"
            onConfirm={onDelete}
            confirmLabel="¿Borrar y cancelar?"
          />
        </SettingRow>
      </Section>
    </div>
  )
}
