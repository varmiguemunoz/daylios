import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { uiState } from '../lib/ui-state'
import type { Go, Screen } from './lib'
import { EMAIL_SECTIONS, SECTIONS, isWorkspaceScreen, rootOf, type Section } from './sections'
import { ChromeContext, ScrollKeyContext, type ConsultoraChrome } from './chrome'
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
import { Tasks } from './screens/Tasks'
import { Home } from './screens/Home'
import { Client } from './screens/Client'
import { Project } from './screens/Project'
import { Meetings } from './screens/Meetings'
import { Meeting } from './screens/Meeting'
import { Pipeline } from './screens/Pipeline'
import { Prospect } from './screens/Prospect'
import { Settings, rememberSettingsTab } from './screens/Settings'
import { AccountButton } from './organisms/account/AccountButton'
import { OrgSwitcher } from './organisms/orgs/OrgSwitcher'
import { SyncIndicator } from './organisms/sync/SyncIndicator'
import { TeamPresence } from './organisms/presence/TeamPresence'
import { viewOf } from './organisms/presence/view'
import { ActivityFeed } from './organisms/activity/ActivityFeed'
import { useActivityState } from './organisms/activity/useActivity'
import { screensFor } from './organisms/activity/open'
import { RemoteChangesProvider } from './organisms/live/RemoteChanges'
import { Search } from './screens/Search'
import { Contacts } from './screens/Contacts'
import { Contact } from './screens/Contact'
import { Sources } from './screens/Sources'
import { Automations } from './screens/Automations'
import { AutomationEditor } from './screens/AutomationEditor'
import { Sequences } from './screens/Sequences'
import { Outreach } from './screens/Outreach'
import { Newsletters } from './screens/Newsletters'
import { Tags } from './screens/Tags'
import { Note } from './screens/Note'
import { Document } from './screens/Document'

const LABEL: Record<Screen['name'], string> = {
  workspace: 'Workspace',
  'ws-note': 'Nota',
  'ws-board': 'Board',
  'ws-image': 'Imagen',
  home: 'Inicio',
  tasks: 'Tareas',
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
  automations: 'Automatizaciones',
  automation: 'Automatización',
  sources: 'Fuentes',
  sequences: 'Secuencias',
  outreach: 'Outreach',
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
  home: 'home',
  tasks: 'tasks',
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
  automations: 'automations',
  automation: 'automations',
  sources: 'sources',
  sequences: 'sequences',
  outreach: 'outreach',
  newsletters: 'newsletters',
  note: null,
  document: 'clients',
  settings: 'settings',
  search: null
}

const SECTION_LABEL: Record<Section, string> = Object.fromEntries(
  [...SECTIONS, ...EMAIL_SECTIONS, { id: 'settings', label: 'Ajustes' }].map((s) => [s.id, s.label])
) as Record<Section, string>

// ---- navegación recordada ----

interface Nav {
  stack: Screen[]
  future: Screen[]

  sections: Partial<Record<Section, Screen[]>>
}

const NAV_KEY = 'consultora.nav'
const MAX_STEPS = 50
const MAX_SECTION_STEPS = 20

const isScreen = (v: unknown): v is Screen => {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  if (typeof s.name !== 'string' || !(s.name in LABEL)) return false
  return (
    ['id', 'query', 'client', 'path'].every(
      (k) => s[k] === undefined || typeof s[k] === 'string'
    ) &&
    (s.folder === undefined || s.folder === null || typeof s.folder === 'string')
  )
}
const screens = (v: unknown): Screen[] => (Array.isArray(v) ? v.filter(isScreen) : [])

function readNav(): Nav {
  const saved = uiState.get<Record<string, unknown> | null>(NAV_KEY, null)
  const stack = screens(saved?.stack).slice(-MAX_STEPS)
  const sections: Nav['sections'] = {}
  const raw = saved?.sections
  if (raw && typeof raw === 'object')
    for (const [id, list] of Object.entries(raw as Record<string, unknown>)) {
      const valid = screens(list)
      if (valid.length) sections[id as Section] = valid
    }
  return {
    stack: stack.length ? stack : [{ name: 'home' }],
    future: screens(saved?.future).slice(0, MAX_STEPS),
    sections
  }
}

function remember(n: Nav): Nav {
  const section = SECTION_OF[n.stack[n.stack.length - 1].name]
  return section ? { ...n, sections: { ...n.sections, [section]: n.stack } } : n
}

const compactNav = (n: Nav): Nav => ({
  stack: n.stack.slice(-MAX_STEPS),
  future: n.future.slice(0, MAX_STEPS),
  sections: Object.fromEntries(
    Object.entries(n.sections).map(([id, list]) => [id, (list ?? []).slice(-MAX_SECTION_STEPS)])
  )
})

const scrollKeyOf = (s: Screen): string =>
  `scroll.${s.name}:${'id' in s ? s.id : 'query' in s ? s.query : 'path' in s ? s.path : ''}`

const keyOf = (depth: number, s: Screen): string =>
  `${depth}:${s.name}:${'id' in s ? s.id : 'query' in s ? s.query : ''}`

const typing = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement ||
  t instanceof HTMLTextAreaElement ||
  t instanceof HTMLSelectElement ||
  (t instanceof HTMLElement && t.isContentEditable)

export function ConsultoraApp(): React.JSX.Element {
  // Navegación recordada en ui-state.json: al reabrir estás donde lo dejaste, con atrás y adelante.
  const [nav, setNav] = useState<Nav>(readNav)
  const { stack, future } = nav
  useEffect(() => uiState.set(NAV_KEY, compactNav(nav)), [nav])

  // Toda la ventana usa el tema Obsidian (también los diálogos, que van en <body>).
  useEffect(() => {
    document.body.classList.add('theme-obsidian')
    return () => document.body.classList.remove('theme-obsidian')
  }, [])

  const screen = stack[stack.length - 1]

  const go: Go = useCallback(
    (next) => setNav((n) => ({ ...n, stack: [...n.stack, next].slice(-MAX_STEPS), future: [] })),
    []
  )
  const back = useCallback(
    () =>
      setNav((n) =>
        n.stack.length < 2
          ? n
          : {
              ...n,
              stack: n.stack.slice(0, -1),
              future: [n.stack[n.stack.length - 1], ...n.future].slice(0, MAX_STEPS)
            }
      ),
    []
  )
  const forward = useCallback(
    () =>
      setNav((n) =>
        n.future.length ? { ...n, stack: [...n.stack, n.future[0]], future: n.future.slice(1) } : n
      ),
    []
  )
  const reset = useCallback(
    (screens: Screen[]) => setNav((n) => ({ ...remember(n), stack: screens, future: [] })),
    []
  )

  const openSection = useCallback(
    (id: Section) =>
      setNav((n) => {
        const kept = remember(n)
        const here = SECTION_OF[n.stack[n.stack.length - 1].name] === id
        return {
          ...kept,
          stack: here ? [rootOf(id)] : (kept.sections[id] ?? [rootOf(id)]),
          future: []
        }
      }),
    []
  )
  const replaceWithRoot = useCallback(
    () =>
      setNav((n) => {
        const top = n.stack[n.stack.length - 1]
        const section = SECTION_OF[top.name]
        const root: Screen = section ? rootOf(section) : { name: 'home' }
        const rest = n.stack.slice(0, -1)
        const prev = rest[rest.length - 1]
        return { ...n, stack: prev && prev.name === root.name ? rest : [...rest, root] }
      }),
    []
  )

  useEffect(() => {
    if (isWorkspaceScreen(screen)) rememberWorkspaceScreen(screen)
  }, [screen])

  // Una nota del menubar o el atajo global pidieron abrir algo.
  useEffect(
    () =>
      window.api.onConsultoraNavigate((target) => {
        if (target.open) {
          const { entity, id } = target.open
          void screensFor(entity, id).then((screens) => screens && reset(screens))
        } else if (target.account) {
          rememberSettingsTab('account')
          reset([{ name: 'settings' }])
        } else if (target.workspace) reset([lastWorkspaceScreen()])
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

  const chrome = useMemo<ConsultoraChrome>(
    () => ({ openSection, reset, setTitle, replaceWithRoot }),
    [openSection, reset, setTitle, replaceWithRoot]
  )

  return (
    <ChromeContext.Provider value={chrome}>
      <RemoteChangesProvider>
        <WorkspaceProvider screen={screen} go={go}>
          <Frame
            screen={screen}
            stackSize={stack.length}
            canForward={future.length > 0}
            go={go}
            back={back}
            forward={forward}
            openSection={openSection}
            reset={reset}
            title={named.key === currentKey ? named.title : null}
          />
        </WorkspaceProvider>
      </RemoteChangesProvider>
    </ChromeContext.Provider>
  )
}

function routeOf(screen: Screen, section: Section | null, title: string | null): string {
  if (!section) return [LABEL[screen.name], title].filter(Boolean).join(' › ')
  const isRoot = rootOf(section).name === screen.name
  return isRoot
    ? SECTION_LABEL[section]
    : `${SECTION_LABEL[section]} › ${title ?? LABEL[screen.name]}`
}

function Frame({
  screen,
  stackSize,
  canForward,
  go,
  back,
  forward,
  openSection,
  reset,
  title
}: {
  screen: Screen
  stackSize: number
  canForward: boolean
  go: Go
  back: () => void
  forward: () => void
  openSection: (id: Section) => void
  reset: (screens: Screen[]) => void
  title: string | null
}): React.JSX.Element {
  const workspace = useWorkspace()
  const inWorkspace = isWorkspaceScreen(screen)
  const sidebar = useSidebar(inWorkspace ? 'workspace' : 'consultora')
  const activity = useActivityState()
  const view = viewOf(screen, workspace.active?.path ?? null)
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
      if (mod && key === ',') return run(() => openSection('settings'))
      // Esc vuelve atrás fuera del workspace; dentro no saca de un archivo, como en Obsidian.
      if (e.key === 'Escape' && !inWorkspace) back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [workspace, inWorkspace, sidebar.toggle, back, forward, openSection])

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
        recorder={
          <>
            <TeamPresence view={view} />
            <SyncIndicator />
            <Recorder go={go} />
          </>
        }
        org={
          <OrgSwitcher
            onManage={() => {
              rememberSettingsTab('account')
              openSection('settings')
            }}
          />
        }
        account={
          <AccountButton
            onOpenAccount={() => {
              rememberSettingsTab('account')
              openSection('settings')
            }}
          />
        }
        onMore={
          inWorkspace && workspace.active && workspace.active.kind !== 'folder'
            ? workspace.openMore
            : undefined
        }
        sidebar={sidebar}
        sections={<SectionNav current={section} onOpen={openSection} />}
        files={<FileExplorer activePath={workspace.active?.path ?? ''} />}
        activity={
          activity.enabled ? (
            <ActivityFeed active={sidebar.visible && sidebar.tab === 'activity'} onOpen={reset} />
          ) : undefined
        }
        activityUnseen={activity.unseen}
        onSearch={() => setSearching(true)}
        onNewNote={() => void workspace.actions.newNote(workspace.folderId)}
        onNewBoard={() => void workspace.actions.newBoard(workspace.folderId)}
        onSettings={() => openSection('settings')}
        settingsActive={section === 'settings'}
      >
        {inWorkspace ? (
          // Una sola instancia mientras se navega por la bóveda.
          <WorkspacePane screen={screen} back={back} />
        ) : (
          <div className="min-h-0 flex-1">
            <ScrollKeyContext.Provider value={scrollKeyOf(screen)}>
              <ScreenView key={stackSize + screen.name} screen={screen} go={go} back={back} />
            </ScrollKeyContext.Provider>
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
    case 'home':
      return <Home go={go} />
    case 'tasks':
      return <Tasks openId={screen.task} />
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
    case 'automations':
      return <Automations go={go} />
    case 'automation':
      return <AutomationEditor id={screen.id} back={back} />
    case 'sources':
      return <Sources go={go} />
    case 'sequences':
      return <Sequences go={go} />
    case 'outreach':
      return <Outreach go={go} />
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
