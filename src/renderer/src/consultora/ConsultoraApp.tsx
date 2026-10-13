import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon, Settings as SettingsIcon } from 'lucide-react'
import type { Go, Screen } from './lib'
import { EMAIL_SECTIONS, SECTIONS, isWorkspaceScreen, rootOf, type Section } from './sections'
import { ChromeContext, type ConsultoraChrome } from './chrome'
import { WorkspaceApp, lastWorkspaceScreen, rememberWorkspaceScreen } from './workspace/WorkspaceApp'
import { Recorder } from './Recorder'
import { Clients } from './screens/Clients'
import { Client } from './screens/Client'
import { Project } from './screens/Project'
import { Meetings } from './screens/Meetings'
import { Meeting } from './screens/Meeting'
import { Pipeline } from './screens/Pipeline'
import { Prospect } from './screens/Prospect'
import { Settings } from './screens/Settings'
import { Search } from './screens/Search'
import { Contacts } from './screens/Contacts'
import { Contact } from './screens/Contact'
import { Sources } from './screens/Sources'
import { Rules } from './screens/Rules'
import { Sequences } from './screens/Sequences'
import { Newsletters } from './screens/Newsletters'
import { Tags } from './screens/Tags'
import { Note } from './screens/Note'
import { Document } from './screens/Document'

/** Nombre corto de cada pantalla, para el botón «Atrás». */
const LABEL: Record<Screen['name'], string> = {
  workspace: 'Workspace',
  'ws-note': 'Nota',
  'ws-board': 'Board',
  'ws-image': 'Imagen',
  clients: 'Clientes',
  client: 'Cliente',
  project: 'Proyecto',
  meetings: 'Reuniones',
  meeting: 'Reunión',
  pipeline: 'Pipeline',
  prospect: 'Prospecto',
  tags: 'Tags',
  contacts: 'Contactos',
  contact: 'Contacto',
  sources: 'Fuentes',
  rules: 'Reglas',
  sequences: 'Secuencias',
  newsletters: 'Newsletters',
  note: 'Nota',
  document: 'Documento',
  settings: 'Ajustes',
  search: 'Búsqueda'
}

const SECTION_OF: Record<Screen['name'], Section | null> = {
  workspace: 'workspace',
  'ws-note': 'workspace',
  'ws-board': 'workspace',
  'ws-image': 'workspace',
  clients: 'clients',
  client: 'clients',
  project: 'clients',
  meetings: 'meetings',
  meeting: 'meetings',
  pipeline: 'pipeline',
  prospect: 'pipeline',
  tags: 'tags',
  contacts: 'contacts',
  contact: 'contacts',
  sources: 'sources',
  rules: 'rules',
  sequences: 'sequences',
  newsletters: 'newsletters',
  note: null,
  document: 'clients',
  settings: 'settings',
  search: null
}

/**
 * Ventana Consultora: barra lateral (secciones), barra superior (buscar + grabar) y la pantalla actual.
 * Navegación = pila de pantallas: abrir algo la apila, «Atrás» (o Esc) la quita, la barra lateral reinicia.
 */
export function ConsultoraApp(): React.JSX.Element {
  const [stack, setStack] = useState<Screen[]>([{ name: 'clients' }])
  const [query, setQuery] = useState('')
  const [recorder, setRecorder] = useState<'idle' | 'starting' | 'recording' | 'stopping'>('idle')
  const searchRef = useRef<HTMLInputElement>(null)

  const screen = stack[stack.length - 1]
  const previous = stack[stack.length - 2]
  const go: Go = (next) => setStack((s) => [...s, next])
  const back = (): void => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const backLabel = previous ? LABEL[previous.name] : ''
  const section = SECTION_OF[screen.name]
  // Workspace a pantalla completa: sin barra lateral ni cabecera (la grabación sigue viva, solo oculta).
  // Al detener una grabación vuelve el cromo para mostrar la hoja de guardado.
  const immersive = isWorkspaceScreen(screen) && recorder !== 'stopping'

  useEffect(() => {
    if (isWorkspaceScreen(screen)) rememberWorkspaceScreen(screen)
  }, [screen])

  // Una nota del menubar pidió abrir un cliente.
  useEffect(
    () =>
      window.api.onConsultoraNavigate((target) => {
        if (target.workspace) setStack([lastWorkspaceScreen()])
        else if (target.client) setStack([{ name: 'clients' }, { name: 'client', id: target.client }])
      }),
    []
  )

  // ⌘F busca · Esc vuelve atrás (si no se está escribiendo). En el workspace los atajos son suyos
  // (⌘F y ⌘O buscan en la bóveda, ⌘[ vuelve atrás) y Esc no saca de un archivo, como en Obsidian.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      const mod = e.metaKey || e.ctrlKey
      if (immersive) {
        if (mod && e.key === '[') {
          e.preventDefault()
          setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
        }
        return
      }
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape' && !typing) {
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [immersive])

  const chrome: ConsultoraChrome = {
    recording: recorder === 'recording',
    openSection: (id: Section) => setStack([rootOf(id)]),
    reset: setStack
  }

  return (
    <ChromeContext.Provider value={chrome}>
    <div className="flex h-full">
      {!immersive && (
      <nav
        aria-label="Secciones"
        className="flex w-56 shrink-0 flex-col bg-surface/50 px-3 pt-12 pb-4 [-webkit-app-region:drag]"
      >
        <p className="px-3 pb-4 text-label font-extrabold">Consultora</p>
        <div className="flex flex-col gap-0.5 [-webkit-app-region:no-drag]">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <SideItem
              key={id}
              active={section === id}
              onClick={() => setStack([rootOf(id)])}
              icon={<Icon size={16} strokeWidth={2.5} />}
            >
              {label}
            </SideItem>
          ))}
        </div>
        <p className="px-3 pt-6 pb-2 text-micro font-bold text-milk-soft">Email</p>
        <div className="flex flex-col gap-0.5 [-webkit-app-region:no-drag]">
          {EMAIL_SECTIONS.map(({ id, label, icon: Icon }) => (
            <SideItem
              key={id}
              active={section === id}
              onClick={() => setStack([rootOf(id)])}
              icon={<Icon size={16} strokeWidth={2.5} />}
            >
              {label}
            </SideItem>
          ))}
        </div>
        <div className="mt-auto [-webkit-app-region:no-drag]">
          <SideItem
            active={section === 'settings'}
            onClick={() => setStack([{ name: 'settings' }])}
            icon={<SettingsIcon size={16} strokeWidth={2.5} />}
          >
            Ajustes
          </SideItem>
        </div>
      </nav>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header
          className={`h-14 shrink-0 items-center justify-between gap-4 px-6 [-webkit-app-region:drag] ${
            immersive ? 'hidden' : 'flex'
          }`}
        >
          <form
            className="flex h-9 w-full max-w-80 min-w-0 items-center gap-2 rounded-full bg-surface px-3.5 [-webkit-app-region:no-drag] focus-within:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_70%,transparent)]"
            onSubmit={(e) => {
              e.preventDefault()
              if (query.trim().length >= 2) go({ name: 'search', query: query.trim() })
            }}
          >
            <SearchIcon
              size={15}
              strokeWidth={2.5}
              className="shrink-0 text-milk-soft"
              aria-hidden
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en todo (⌘F)"
              aria-label="Buscar"
              className="min-w-0 flex-1 bg-transparent text-caption outline-none"
            />
          </form>
          <Recorder go={go} onStateChange={setRecorder} />
        </header>

        <main className="min-h-0 flex-1">
          {isWorkspaceScreen(screen) ? (
            // Una sola instancia: el explorador no se vuelve a montar al abrir otro archivo.
            <WorkspaceApp screen={screen} go={go} back={back} canGoBack={stack.length > 1} />
          ) : (
            <ScreenView
              key={stack.length + screen.name}
              screen={screen}
              go={go}
              back={back}
              backLabel={backLabel}
            />
          )}
        </main>
      </div>
    </div>
    </ChromeContext.Provider>
  )
}

function ScreenView({
  screen,
  go,
  back,
  backLabel
}: {
  screen: Screen
  go: Go
  back: () => void
  backLabel: string
}): React.JSX.Element {
  switch (screen.name) {
    case 'workspace':
    case 'ws-note':
    case 'ws-board':
    case 'ws-image':
      return <WorkspaceApp screen={screen} go={go} back={back} canGoBack />
    case 'clients':
      return <Clients go={go} />
    case 'client':
      return <Client id={screen.id} go={go} back={back} backLabel={backLabel} />
    case 'project':
      return <Project id={screen.id} go={go} back={back} backLabel={backLabel} />
    case 'meetings':
      return <Meetings go={go} />
    case 'meeting':
      return <Meeting id={screen.id} back={back} backLabel={backLabel} />
    case 'pipeline':
      return <Pipeline go={go} />
    case 'prospect':
      return <Prospect id={screen.id} go={go} back={back} backLabel={backLabel} />
    case 'tags':
      return <Tags />
    case 'contacts':
      return <Contacts go={go} />
    case 'contact':
      return <Contact id={screen.id} go={go} back={back} backLabel={backLabel} />
    case 'sources':
      return <Sources go={go} />
    case 'rules':
      return <Rules />
    case 'sequences':
      return <Sequences go={go} />
    case 'newsletters':
      return <Newsletters />
    case 'note':
      return <Note id={screen.id} go={go} back={back} backLabel={backLabel} />
    case 'document':
      return (
        <Document client={screen.client} path={screen.path} back={back} backLabel={backLabel} />
      )
    case 'settings':
      return <Settings />
    case 'search':
      return <Search query={screen.query} go={go} />
  }
}

function SideItem({
  active,
  onClick,
  icon,
  children
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-10 w-full items-center gap-2.5 rounded-full px-3 text-caption font-bold transition-colors ${
        active ? 'bg-surface-raised text-milk' : 'text-milk-soft hover:text-milk'
      }`}
    >
      <span className={active ? 'text-apricot' : ''}>{icon}</span>
      {children}
    </button>
  )
}
