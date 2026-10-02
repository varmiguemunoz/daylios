import { useCallback, useState } from 'react'
import { ArrowDown, ArrowUp, FolderOpen, Plus, X } from 'lucide-react'
import type { SettingsInput, Stage, StageKind } from '@shared/consultora'
import { api, attempt, openPath, useLoad } from '../lib'
import { Button, ErrorNote, Field, Page, Section, Select } from '../ui'

type Draft = Partial<Stage> & { name: string; kind: StageKind }

const KINDS = [
  { value: 'open', label: 'Abierta' },
  { value: 'won', label: 'Ganada (crea cliente)' },
  { value: 'lost', label: 'Perdida' }
]

/** Ajustes: OpenAI, carpeta de clientes, modelos y etapas del pipeline. Todo se guarda al momento. */
export function Settings(): React.JSX.Element {
  const stagesLoad = useCallback(() => api.listStages(), [])
  const { data: stages } = useLoad(stagesLoad)
  const [draft, setDraft] = useState<Draft[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const list = draft ?? stages ?? []
  const edit = (next: Draft[]): void => setDraft(next)
  const swap = (i: number, j: number): void => {
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    edit(next)
  }

  const save = async (): Promise<void> => {
    const failed = await attempt(() => api.saveStages(list))
    setError(failed)
    if (!failed) setDraft(null)
  }

  return (
    <Page title="Ajustes">
      <Connection />
      <Voice />

      <Section
        title="Etapas del pipeline"
        aside={
          draft && (
            <div className="flex gap-2">
              <Button onClick={() => setDraft(null)}>Descartar</Button>
              <Button kind="primary" onClick={() => void save()}>
                Guardar etapas
              </Button>
            </div>
          )
        }
      >
        <ErrorNote message={error} />
        <ul className="flex flex-col gap-1.5">
          {list.map((stage, i) => (
            <li
              key={stage.id ?? `new-${i}`}
              className="flex items-center gap-2 rounded-md bg-surface py-1.5 pr-1.5 pl-4"
            >
              <input
                value={stage.name}
                aria-label="Nombre de la etapa"
                onChange={(e) =>
                  edit(list.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))
                }
                className="min-w-0 flex-1 bg-transparent text-list font-bold outline-none"
              />
              <Select
                label="Tipo"
                value={stage.kind}
                options={KINDS}
                onChange={(kind) =>
                  edit(list.map((s, j) => (j === i ? { ...s, kind: kind as StageKind } : s)))
                }
              />
              <IconButton label="Subir" disabled={i === 0} onClick={() => swap(i, i - 1)}>
                <ArrowUp size={15} strokeWidth={2.5} />
              </IconButton>
              <IconButton
                label="Bajar"
                disabled={i === list.length - 1}
                onClick={() => swap(i, i + 1)}
              >
                <ArrowDown size={15} strokeWidth={2.5} />
              </IconButton>
              <IconButton
                label="Quitar"
                danger
                onClick={() => edit(list.filter((_, j) => j !== i))}
              >
                <X size={15} strokeWidth={2.5} />
              </IconButton>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Button onClick={() => edit([...list, { name: 'Nueva etapa', kind: 'open' }])}>
            <Plus size={15} strokeWidth={3} />
            Añadir etapa
          </Button>
        </div>
      </Section>
    </Page>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 shrink-0 place-items-center rounded-full text-milk-soft disabled:text-milk-faint ${
        danger ? 'hover:bg-rose/15 hover:text-rose' : 'hover:bg-hairline hover:text-milk'
      }`}
    >
      {children}
    </button>
  )
}

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' }
]

/**
 * OpenAI y carpeta de clientes. La API key se escribe aquí y se guarda solo en main
 * (settings.json, permisos 600); la ventana nunca la vuelve a ver completa.
 */
function Connection(): React.JSX.Element {
  const load = useCallback(() => api.settings(), [])
  const { data: settings } = useLoad(load)
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)

  const save = async (input: SettingsInput): Promise<boolean> => {
    const failed = await attempt(() => api.saveSettings(input))
    setError(failed)
    setTest(null)
    return !failed
  }

  const saveKey = async (): Promise<void> => {
    if (await save({ openaiApiKey: key })) {
      setKey('')
      setTest(await api.testApiKey())
    }
  }

  const pickFolder = async (): Promise<void> => {
    const folder = await api.pickFolder()
    if (folder) await save({ docsPath: folder })
  }

  if (!settings) return <Section title="OpenAI y carpeta">{null}</Section>

  const input = 'bg-transparent text-list outline-none'

  return (
    <>
      <Section title="OpenAI">
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
                  settings.hasApiKey
                    ? `API key · guardada (${settings.apiKeyHint})`
                    : 'API key · falta'
                }
              >
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={settings.hasApiKey ? 'Pega otra para reemplazarla' : 'sk-…'}
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
              {settings.hasApiKey && (
                <>
                  <Button onClick={() => void api.testApiKey().then(setTest)}>Probar</Button>
                  <Button kind="danger" onClick={() => void save({ openaiApiKey: '' })}>
                    Quitar
                  </Button>
                </>
              )}
            </div>
          </form>

          {test && (
            <p
              className={`rounded-md px-4 py-3 text-caption ${test.ok ? 'bg-mint/15 text-mint' : 'bg-coral/12 text-coral'}`}
            >
              {test.message}
            </p>
          )}
          {!settings.hasApiKey && (
            <p className="px-1 text-caption text-milk-soft">
              Sin API key todo funciona salvo transcribir y resumir reuniones. Créala en
              platform.openai.com → API keys.
            </p>
          )}

          <div className="mt-2 grid grid-cols-3 gap-2">
            <Field label="Modelo de transcripción">
              <input
                key={`t-${settings.transcribeModel}`}
                defaultValue={settings.transcribeModel}
                onBlur={(e) =>
                  e.target.value !== settings.transcribeModel &&
                  void save({ transcribeModel: e.target.value })
                }
                spellCheck={false}
                className={input}
              />
            </Field>
            <Field label="Modelo de resumen">
              <input
                key={`s-${settings.summaryModel}`}
                defaultValue={settings.summaryModel}
                onBlur={(e) =>
                  e.target.value !== settings.summaryModel &&
                  void save({ summaryModel: e.target.value })
                }
                spellCheck={false}
                className={input}
              />
            </Field>
            <Field label="Idioma del resumen">
              <select
                value={settings.summaryLanguage}
                onChange={(e) => void save({ summaryLanguage: e.target.value })}
                className={`${input} cursor-pointer`}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Carpeta de clientes">
        <div className="flex items-center gap-2 rounded-md bg-surface py-2 pr-2 pl-5">
          <span className="min-w-0 flex-1 truncate text-list" title={settings.docsPath}>
            {settings.docsPath}
          </span>
          <Button onClick={() => void openPath(settings.docsPath).catch(() => undefined)}>
            <FolderOpen size={15} strokeWidth={2.5} />
            Abrir
          </Button>
          <Button kind="primary" onClick={() => void pickFolder()}>
            Cambiar…
          </Button>
        </div>
        <p className="mt-2 px-1 text-caption text-milk-soft">
          Aquí se crea una carpeta por cliente nuevo. Cambiarla no mueve las carpetas de los
          clientes que ya existen.
        </p>
      </Section>

      <ErrorNote message={error} />
    </>
  )
}

const SHORTCUTS = [
  { value: 'Alt+Space', label: '⌥ Espacio' },
  { value: 'CommandOrControl+Shift+Space', label: '⌘ ⇧ Espacio' },
  { value: 'CommandOrControl+Shift+P', label: '⌘ ⇧ P' },
  { value: 'Alt+Shift+Space', label: '⌥ ⇧ Espacio' }
]

/**
 * Nota de voz: atajo global (mantener pulsado, hablar, soltar) → nota en markdown en Notas.
 * «Mantener pulsado» necesita el permiso de Accesibilidad; sin él funciona como interruptor.
 */
function Voice(): React.JSX.Element {
  const load = useCallback(() => api.voiceStatus(), [])
  const { data: voice } = useLoad(load)
  const [error, setError] = useState<string | null>(null)
  const [retried, setRetried] = useState<string | null>(null)

  if (!voice) return <Section title="Nota de voz">{null}</Section>

  const save = async (input: SettingsInput): Promise<void> => setError(await attempt(() => api.saveSettings(input)))
  const options = SHORTCUTS.some((s) => s.value === voice.shortcut)
    ? SHORTCUTS
    : [...SHORTCUTS, { value: voice.shortcut, label: voice.shortcut }]

  return (
    <Section title="Nota de voz">
      <div className="rounded-md bg-surface px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-list font-bold">
            <input
              type="checkbox"
              checked={voice.enabled}
              onChange={(e) => void save({ voiceEnabled: e.target.checked })}
              className="size-4 cursor-pointer accent-[var(--color-apricot)]"
            />
            Activada
          </label>
          <Select label="Atajo" value={voice.shortcut} options={options} onChange={(voiceShortcut) => void save({ voiceShortcut })} />
          <span className="text-caption text-milk-soft">
            {!voice.enabled
              ? 'Desactivada'
              : !voice.registered
                ? ''
                : voice.mode === 'hold'
                  ? 'Mantén pulsado, habla y suelta.'
                  : 'Pulsa para empezar y otra vez para terminar.'}
          </span>
        </div>

        {voice.enabled && !voice.registered && (
          <p className="mt-3 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">
            Otra app ya usa ese atajo. Elige otro.
          </p>
        )}

        {voice.enabled && !voice.accessibility && (
          <div className="mt-3 rounded-md bg-apricot/10 px-4 py-3 text-caption text-apricot">
            <p>
              Para «mantener pulsado» macOS pide el permiso de <b>Accesibilidad</b> (sirve para saber cuándo sueltas la
              tecla; DayliOS no lee lo que escribes). Actívalo para daily-os y pulsa «Ya lo activé».
            </p>
            <div className="mt-3 flex gap-2">
              <Button kind="primary" onClick={() => void window.api.permissions.open('accessibility')}>
                Abrir Ajustes del Sistema
              </Button>
              <Button onClick={() => void attempt(() => api.refreshVoice()).then(setError)}>Ya lo activé</Button>
            </div>
          </div>
        )}

        {voice.pending > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-butter/10 px-4 py-3 text-caption text-butter">
            <span>
              {voice.pending} {voice.pending === 1 ? 'nota de voz no se pudo transcribir' : 'notas de voz no se pudieron transcribir'}.
            </span>
            <Button
              onClick={() =>
                void api.retryVoiceNotes().then(({ created, failed }) =>
                  setRetried(failed ? `${created} creadas, ${failed} siguen fallando.` : `${created} creadas.`)
                )
              }
            >
              Reintentar
            </Button>
          </div>
        )}
        {retried && <p className="mt-2 text-caption text-milk-soft">{retried}</p>}

        <p className="mt-3 text-caption text-milk-soft">
          Funciona en cualquier app. Lo que dices se transcribe y se escribe como nota en markdown en la pestaña Notas.
          El audio se borra al terminar.
        </p>
      </div>
      <ErrorNote message={error} />
    </Section>
  )
}
