import { useCallback, useRef, useState } from 'react'
import { Cog, FolderOpen, Keyboard, Mail, Mic, UsersRound, Waypoints } from 'lucide-react'
import type { SettingsInput } from '@shared/consultora'
import { api, attempt, openPath, useLoad } from '../lib'
import { Button, ErrorNote, Field, Section, Select } from '../ui'
import { prefs } from '../workspace/lib'
import { useScrollMemory } from '../../lib/ui-state'
import { SettingRow, Toggle } from '../molecules/SettingRow'
import { AppSettings } from '../organisms/AppSettings'
import { EmailSettings } from './SettingsEmail'
import { HubSettings } from './SettingsHub'
import { AccountSettings } from './SettingsAccount'
import { fileManager, isMac, isWindows, kbd } from '../../lib/platform'

export type Category = 'general' | 'account' | 'email' | 'hub' | 'voice' | 'shortcuts'

const CATEGORIES: { id: Category; label: string; Icon: typeof Cog }[] = [
  { id: 'general', label: 'General', Icon: Cog },
  { id: 'account', label: 'Cuenta y equipo', Icon: UsersRound },
  { id: 'email', label: 'Email', Icon: Mail },
  { id: 'hub', label: 'Hub de leads', Icon: Waypoints },
  { id: 'voice', label: 'Nota de voz', Icon: Mic },
  { id: 'shortcuts', label: 'Atajos', Icon: Keyboard }
]
const TAB_KEY = 'settings.tab'

export const rememberSettingsTab = (id: Category): void => prefs.set(TAB_KEY, id)

export function Settings(): React.JSX.Element {
  const [tab, setTab] = useState<Category>(() => {
    const saved = prefs.get(TAB_KEY)
    return CATEGORIES.some((c) => c.id === saved) ? (saved as Category) : 'general'
  })
  const scroller = useRef<HTMLDivElement>(null)
  useScrollMemory(scroller, `scroll.settings:${tab}`)
  const choose = (id: Category): void => {
    setTab(id)
    prefs.set(TAB_KEY, id)
  }

  return (
    <div className="flex h-full min-h-0">
      <nav
        aria-label="Categorías de ajustes"
        className="flex w-[200px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-ob-border bg-ob-alt p-2"
      >
        <p className="px-2.5 pt-1 pb-1.5 text-[12px] font-semibold text-ob-faint">Opciones</p>
        {CATEGORIES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => choose(id)}
            className={`flex h-[30px] items-center gap-2.5 rounded-[4px] px-2.5 text-left text-[13px] transition-colors hover:bg-ob-hover hover:text-ob-text ${
              tab === id ? 'bg-ob-active text-ob-text' : 'text-ob-muted'
            }`}
          >
            <Icon size={15} className="shrink-0" aria-hidden />
            {label}
          </button>
        ))}
      </nav>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="@container mx-auto max-w-[808px] px-6 pt-6 pb-16">
          <h1 className="text-[20px] font-semibold text-ob-text">
            {CATEGORIES.find((c) => c.id === tab)?.label}
          </h1>
          {tab === 'general' && (
            <>
              <Connection />
              <AppSettings />
              <Section title="Interfaz">
                <SettingRow
                  name="Restablecer el diseño de las ventanas"
                  description="Vuelve a abrir en Inicio, suelta el popover del menubar y olvida filtros, scroll y tamaños. No toca tus datos."
                >
                  <Button
                    onClick={() => void window.api.ui.reset().then(() => window.location.reload())}
                  >
                    Restablecer
                  </Button>
                </SettingRow>
              </Section>
              <p className="mt-8 text-[13px] text-ob-faint">
                Las columnas del pipeline se editan en Pipeline, con «Editar pipeline».
              </p>
            </>
          )}
          {tab === 'account' && <AccountSettings />}
          {tab === 'email' && <EmailSettings />}
          {tab === 'hub' && <HubSettings />}
          {tab === 'voice' && <Voice />}
          {tab === 'shortcuts' && <WorkspaceKey />}
        </div>
      </div>
    </div>
  )
}

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' }
]

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

  const pickWorkspace = async (): Promise<void> => {
    const folder = await api.pickFolder()
    if (folder) await save({ workspacePath: folder })
  }

  if (!settings) return <Section title="OpenAI y carpeta">{null}</Section>

  const input = 'bg-transparent text-[14px] text-ob-text outline-none placeholder:text-ob-faint'

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
              className={`rounded-[6px] border-l-2 px-3 py-2 text-[13px] ${test.ok ? 'border-ob-green bg-ob-green/10 text-ob-green' : 'border-ob-red bg-ob-red/10 text-ob-red'}`}
            >
              {test.message}
            </p>
          )}
          {!settings.hasApiKey && (
            <p className="px-1 text-caption text-ob-muted">
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

      <Section title="Carpetas">
        <SettingRow
          name="Carpeta de clientes"
          description={
            <>
              <span className="block truncate text-ob-text" title={settings.docsPath}>
                {settings.docsPath}
              </span>
              Aquí se crea una carpeta por cliente nuevo. Cambiarla no mueve las que ya existen.
            </>
          }
        >
          <Button onClick={() => void openPath(settings.docsPath).catch(() => undefined)}>
            <FolderOpen size={15} />
            Abrir
          </Button>
          <Button onClick={() => void pickFolder()}>Cambiar…</Button>
        </SettingRow>
        <SettingRow
          name="Carpeta del workspace"
          description={
            <>
              <span className="block truncate text-ob-text" title={settings.workspacePath}>
                {settings.workspacePath}
              </span>
              Tus notas, boards y archivos viven aquí como archivos normales. Cambiarla no mueve
              nada: mueve la carpeta en {fileManager()} y elige la nueva ubicación.
            </>
          }
        >
          <Button onClick={() => void openPath(settings.workspacePath).catch(() => undefined)}>
            <FolderOpen size={15} />
            Abrir
          </Button>
          <Button onClick={() => void pickWorkspace()}>Cambiar…</Button>
        </SettingRow>
      </Section>

      <ErrorNote message={error} />
    </>
  )
}

const SHORTCUTS = [
  ...(isWindows() ? [] : [{ value: 'Alt+Space', label: kbd('⌥ Espacio') }]),
  { value: 'CommandOrControl+Shift+Space', label: kbd('⌘ ⇧ Espacio') },
  { value: 'CommandOrControl+Shift+P', label: kbd('⌘ ⇧ P') },
  { value: 'Alt+Shift+Space', label: kbd('⌥ ⇧ Espacio') }
]

const WORKSPACE_SHORTCUTS = [
  { value: 'Alt+CommandOrControl+W', label: kbd('⌥ ⌘ W') },
  { value: 'Alt+CommandOrControl+O', label: kbd('⌥ ⌘ O') },
  ...(isMac() ? [{ value: 'Control+CommandOrControl+O', label: kbd('⌃ ⌘ O') }] : []),
  { value: 'Alt+Shift+O', label: kbd('⌥ ⇧ O') },
  { value: '', label: 'Desactivado' }
]

function WorkspaceKey(): React.JSX.Element {
  const load = useCallback(() => api.workspaceShortcutStatus(), [])
  const { data } = useLoad(load)
  const [error, setError] = useState<string | null>(null)
  if (!data) return <Section title="Workspace">{null}</Section>

  const options = WORKSPACE_SHORTCUTS.some((s) => s.value === data.shortcut)
    ? WORKSPACE_SHORTCUTS
    : [...WORKSPACE_SHORTCUTS, { value: data.shortcut, label: data.shortcut }]

  return (
    <Section title="Workspace">
      <SettingRow
        name="Abrir el workspace"
        description="Desde cualquier app abre el workspace; otra vez lo oculta."
      >
        <Select
          label="Atajo del workspace"
          value={data.shortcut}
          options={options}
          onChange={(workspaceShortcut) =>
            void attempt(() => api.saveSettings({ workspaceShortcut })).then(setError)
          }
        />
      </SettingRow>
      {data.shortcut && !data.registered && (
        <p className="mt-3 rounded-[6px] border-l-2 border-ob-red bg-ob-red/10 px-3 py-2 text-caption text-ob-red">
          Otra app ya usa ese atajo. Elige otro.
        </p>
      )}
      {isMac() && data.shortcut === 'Alt+CommandOrControl+W' && data.registered && (
        <p className="mt-2 px-1 text-caption text-ob-muted">
          En Finder y en el navegador ⌥⌘W es «Cerrar todas las ventanas»: mientras Alisuite esté
          abierto, ese atajo abre el workspace.
        </p>
      )}
      <ErrorNote message={error} />
    </Section>
  )
}

function Voice(): React.JSX.Element {
  const load = useCallback(() => api.voiceStatus(), [])
  const { data: voice } = useLoad(load)
  const [error, setError] = useState<string | null>(null)
  const [retried, setRetried] = useState<string | null>(null)

  if (!voice) return <Section title="Dictado">{null}</Section>

  const save = async (input: SettingsInput): Promise<void> =>
    setError(await attempt(() => api.saveSettings(input)))
  const options = SHORTCUTS.some((s) => s.value === voice.shortcut)
    ? SHORTCUTS
    : [...SHORTCUTS, { value: voice.shortcut, label: voice.shortcut }]

  return (
    <Section title="Dictado">
      <div>
        <SettingRow
          name="Activada"
          description="Funciona en cualquier app. Lo que dices se escribe como nota en markdown; el audio se borra al terminar."
        >
          <Toggle
            label="Nota de voz activada"
            checked={voice.enabled}
            onChange={(voiceEnabled) => void save({ voiceEnabled })}
          />
        </SettingRow>
        <SettingRow
          name="Atajo"
          description={
            !voice.enabled
              ? 'Desactivada'
              : !voice.registered
                ? ''
                : voice.mode === 'hold'
                  ? 'Mantén pulsado, habla y suelta.'
                  : 'Pulsa para empezar y otra vez para terminar.'
          }
        >
          <Select
            label="Atajo"
            value={voice.shortcut}
            options={options}
            onChange={(voiceShortcut) => void save({ voiceShortcut })}
          />
        </SettingRow>

        {voice.enabled && !voice.registered && (
          <p className="mt-3 rounded-[6px] border-l-2 border-ob-red bg-ob-red/10 px-3 py-2 text-caption text-ob-red">
            Otra app ya usa ese atajo. Elige otro.
          </p>
        )}

        {voice.enabled && !voice.accessibility && (
          <div className="mt-3 rounded-[6px] border-l-2 border-ob-accent bg-ob-accent/10 px-3 py-2 text-caption text-ob-link">
            <p>
              Para «mantener pulsado» macOS pide el permiso de <b>Accesibilidad</b> (sirve para
              saber cuándo sueltas la tecla; Alisuite no lee lo que escribes). Actívalo para
              Alisuite y pulsa «Ya lo activé».
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                kind="primary"
                onClick={() => void window.api.permissions.open('accessibility')}
              >
                Abrir Ajustes del Sistema
              </Button>
              <Button onClick={() => void attempt(() => api.refreshVoice()).then(setError)}>
                Ya lo activé
              </Button>
            </div>
          </div>
        )}

        {voice.pending > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[6px] border-l-2 border-ob-yellow bg-ob-yellow/10 px-3 py-2 text-caption text-ob-yellow">
            <span>
              {voice.pending}{' '}
              {voice.pending === 1
                ? 'nota de voz no se pudo transcribir'
                : 'notas de voz no se pudieron transcribir'}
              .
            </span>
            <Button
              onClick={() =>
                void api
                  .retryVoiceNotes()
                  .then(({ created, failed }) =>
                    setRetried(
                      failed
                        ? `${created} creadas, ${failed} siguen fallando.`
                        : `${created} creadas.`
                    )
                  )
              }
            >
              Reintentar
            </Button>
          </div>
        )}
        {retried && <p className="mt-2 text-caption text-ob-muted">{retried}</p>}
      </div>
      <ErrorNote message={error} />
    </Section>
  )
}
