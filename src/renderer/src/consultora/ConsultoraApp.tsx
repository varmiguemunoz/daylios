import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Go, Screen } from './lib'
import { EMAIL_SECTIONS, SECTIONS, isWorkspaceScreen, rootOf, type Section } from './sections'
import { ChromeContext, type ConsultoraChrome } from './chrome'
import { isOverlayOpen } from '../ui'
import { AppShell } from './shell/AppShell'
import { SectionNav } from './shell/SectionNav'
import { GlobalSwitcher } from './shell/GlobalSwitcher'
import { useSidebar } from './shell/useSidebar'
import {
  WorkspaceProvider,
  lastWorkspaceScreen,
  rememberWorkspaceScreen
} from './workspace/WorkspaceProvider'
import { WorkspacePane } from './workspace/WorkspacePane'
import { useWorkspace } from './workspace/context'
import { FileExplorer } from './workspace/organisms/FileExplorer'
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

/** Nombre corto de cada pantalla, para la ruta de la franja. */
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

/** Nombre de cada sección en la ruta de la franja. */
const SECTION_LABEL: Record<Section, string> = Object.fromEntries(
  [...SECTIONS, ...EMAIL_SECTIONS, { id: 'settings', label: 'Ajustes' }].map((s) => [s.id, s.label])
) as Record<Section, string>

const keyOf = (depth: number, s: Screen): string =>
  `${depth}:${s.name}:${'id' in s ? s.id : 'query' in s ? s.query : ''}`

const typing = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement ||
  t instanceof HTMLTextAreaElement ||
  t instanceof HTMLSelectElement ||
  (t instanceof HTMLElement && t.isContentEditable)

/**
 * Ventana Consultora con el marco de Obsidian en todas las secciones: franja, cinta, barra lateral
 * con Secciones y Archivos, y la pantalla actual. Navegación = pila de pantallas con atrás y adelante.
 */
export function ConsultoraApp(): React.JSX.Element {
  const [nav, setNav] = useState<{ stack: Screen[]; future: Screen[] }>({
    stack: [{ name: 'clients' }],
    future: []
  })
  const { stack, future } = nav

  // Toda la ventana usa el tema Obsidian (también los diálogos, que van en <body>).
  useEffect(() => {
    document.body.classList.add('theme-obsidian')
    return () => document.body.classList.remove('theme-obsidian')
  }, [])

  const screen = stack[stack.length - 1]

  const go: Go = useCallback(
    (next) => setNav((n) => ({ stack: [...n.stack, next], future: [] })),
    []
  )
  const back = useCallback(
    () =>
      setNav((n) =>
        n.stack.length < 2
          ? n
          : { stack: n.stack.slice(0, -1), future: [n.stack[n.stack.length - 1], ...n.future] }
      ),
    []
  )
  const forward = useCallback(
    () =>
      setNav((n) =>
        n.future.length ? { stack: [...n.stack, n.future[0]], future: n.future.slice(1) } : n
      ),
    []
  )
  const reset = useCallback((screens: Screen[]) => setNav({ stack: screens, future: [] }), [])

  useEffect(() => {
    if (isWorkspaceScreen(screen)) rememberWorkspaceScreen(screen)
  }, [screen])

  // Una nota del menubar o el atajo global pidieron abrir algo.
  useEffect(
    () =>
      window.api.onConsultoraNavigate((target) => {
        if (target.workspace) reset([lastWorkspaceScreen()])
        else if (target.client) reset([{ name: 'clients' }, { name: 'client', id: target.client }])
      }),
    [reset]
  )

  // Nombre que declara la pantalla abierta; solo vale para esa pantalla.
  const screenKey = useRef('')
  const currentKey = keyOf(stack.length, screen)
  useLayoutEffect(() => {
    screenKey.current = currentKey
  })
  const [named, setNamed] = useState<{ key: string; title: string | null }>({
    key: '',
    title: null
  })
  const setTitle = useCallback(
    (title: string | null) => setNamed({ key: screenKey.current, title }),
    []
  )

  const chrome: ConsultoraChrome = {
    openSection: (id: Section) => reset([rootOf(id)]),
    reset,
    setTitle
  }

  return (
    <ChromeContext.Provider value={chrome}>
      <WorkspaceProvider screen={screen} go={go}>
        <Frame
          screen={screen}
          stackSize={stack.length}
          canForward={future.length > 0}
          go={go}
          back={back}
          forward={forward}
          reset={reset}
          title={named.key === currentKey ? named.title : null}
        />
      </WorkspaceProvider>
    </ChromeContext.Provider>
  )
}

/** «Clientes» en la lista, «Clientes › Acme» en la ficha. */
function routeOf(screen: Screen, section: Section | null, title: string | null): string {
  if (!section) return [LABEL[screen.name], title].filter(Boolean).join(' › ')
  const isRoot = rootOf(section).name === screen.name
  return isRoot
    ? SECTION_LABEL[section]
    : `${SECTION_LABEL[section]} › ${title ?? LABEL[screen.name]}`
}

/** El marco con lo que depende del workspace (explorador, archivo abierto, selector). */
function Frame({
  screen,
  stackSize,
  canForward,
  go,
  back,
  forward,
  reset,
  title
}: {
  screen: Screen
  stackSize: number
  canForward: boolean
  go: Go
  back: () => void
  forward: () => void
  reset: (screens: Screen[]) => void
  title: string | null
}): React.JSX.Element {
  const workspace = useWorkspace()
  const inWorkspace = isWorkspaceScreen(screen)
  const sidebar = useSidebar(inWorkspace ? 'workspace' : 'consultora')
  const [searching, setSearching] = useState(false)
  const section = SECTION_OF[screen.name]

  // Atajos de la ventana. ⌘K y ⌘O funcionan siempre; el resto no mientras se escribe o hay un diálogo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const run = (fn: () => void): void => {
        e.preventDefault()
        fn()
      }
      if (mod && key === 'k' && !isOverlayOpen()) return run(() => setSearching(true))
      if (mod && key === 'o' && !isOverlayOpen()) return run(workspace.openSwitcher)
      if (isOverlayOpen() || typing(e.target)) return
      if (mod && key === 'f')
        return run(inWorkspace ? workspace.openSwitcher : () => setSearching(true))
      if (mod && key === 'n') return run(() => void workspace.actions.newNote(workspace.folderId))
      if (mod && key === '\\') return run(sidebar.toggle)
      if (mod && key === '[') return run(back)
      if (mod && key === ']') return run(forward)
      if (mod && key === ',') return run(() => reset([{ name: 'settings' }]))
      // Esc vuelve atrás fuera del workspace; dentro no saca de un archivo, como en Obsidian.
      if (e.key === 'Escape' && !inWorkspace) back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [workspace, inWorkspace, sidebar.toggle, back, forward, reset])

  const path = inWorkspace
    ? workspace.active
      ? workspace.active.kind === 'folder'
        ? `Workspace › ${workspace.active.path}`
        : workspace.active.path
      : 'Workspace'
    : routeOf(screen, section, title)

  return (
    <>
      <AppShell
        title={path}
        canBack={stackSize > 1}
        canForward={canForward}
        onBack={back}
        onForward={forward}
        recorder={<Recorder go={go} />}
        onMore={
          inWorkspace && workspace.active && workspace.active.kind !== 'folder'
            ? workspace.openMore
            : undefined
        }
        sidebar={sidebar}
        sections={<SectionNav current={section} onOpen={(id) => reset([rootOf(id)])} />}
        files={<FileExplorer activePath={workspace.active?.path ?? ''} />}
        onSearch={() => setSearching(true)}
        onNewNote={() => void workspace.actions.newNote(workspace.folderId)}
        onNewBoard={() => void workspace.actions.newBoard(workspace.folderId)}
        onSettings={() => reset([{ name: 'settings' }])}
        settingsActive={section === 'settings'}
      >
        {inWorkspace ? (
          // Una sola instancia mientras se navega por la bóveda.
          <WorkspacePane screen={screen} back={back} />
        ) : (
          <div className="min-h-0 flex-1">
            <ScreenView key={stackSize + screen.name} screen={screen} go={go} back={back} />
          </div>
        )}
      </AppShell>
      {searching && <GlobalSwitcher go={go} onClose={() => setSearching(false)} />}
    </>
  )
}

function ScreenView({
  screen,
  go,
  back
}: {
  screen: Screen
  go: Go
  back: () => void
}): React.JSX.Element {
  switch (screen.name) {
    case 'workspace':
    case 'ws-note':
    case 'ws-board':
    case 'ws-image':
      return <WorkspacePane screen={screen} back={back} />
    case 'clients':
      return <Clients go={go} />
    case 'client':
      return <Client id={screen.id} go={go} back={back} />
    case 'project':
      return <Project id={screen.id} go={go} back={back} />
    case 'meetings':
      return <Meetings go={go} />
    case 'meeting':
      return <Meeting id={screen.id} back={back} />
    case 'pipeline':
      return <Pipeline go={go} />
    case 'prospect':
      return <Prospect id={screen.id} go={go} back={back} />
    case 'tags':
      return <Tags />
    case 'contacts':
      return <Contacts go={go} />
    case 'contact':
      return <Contact id={screen.id} go={go} back={back} />
    case 'sources':
      return <Sources go={go} />
    case 'rules':
      return <Rules />
    case 'sequences':
      return <Sequences go={go} />
    case 'newsletters':
      return <Newsletters />
    case 'note':
      return <Note id={screen.id} go={go} back={back} />
    case 'document':
      return <Document client={screen.client} path={screen.path} back={back} />
    case 'settings':
      return <Settings />
    case 'search':
      return <Search query={screen.query} go={go} />
  }
}
