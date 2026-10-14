import { useCallback, useEffect, useState } from 'react'
import { Briefcase, History, NotebookPen, Pin, PinOff, Sun } from 'lucide-react'
import { MENUBAR_WINDOW_KEY, type MenubarWindowState } from '@shared/ui-state'
import type { Task } from '@shared/tasks'
import type { Note } from '@shared/notes'
import { useToday } from './lib/useToday'
import { useDay } from './lib/useDay'
import { hideWindow, notesApi, tasksApi } from './lib/api'
import { uiState } from './lib/ui-state'
import { TodayView } from './components/TodayView'
import { HistoryView } from './components/HistoryView'
import { NotesView } from './components/NotesView'
import { TaskDetail } from './components/TaskDetail'
import { NoteEditor } from './components/NoteEditor'
import { UndoToast } from './components/UndoToast'

type Tab = 'today' | 'history' | 'notes'

type Screen =
  | { name: Tab }
  | { name: 'task'; task: Task; from: 'today' | 'history'; parent?: Task; fromList?: boolean }
  | { name: 'note'; note: Note; trail?: Note[] }

const TABS: { id: Tab; label: string; icon: typeof Sun; key: string }[] = [
  { id: 'today', label: 'Hoy', icon: Sun, key: '⌘1' },
  { id: 'history', label: 'Historial', icon: History, key: '⌘2' },
  { id: 'notes', label: 'Notas', icon: NotebookPen, key: '⌘3' }
]

const TAB_LABEL: Record<Tab, string> = { today: 'Hoy', history: 'Historial', notes: 'Notas' }

type StoredScreen =
  | { name: Tab }
  | { name: 'task'; id: string; from: 'today' | 'history'; parentId?: string; fromList?: boolean }
  | { name: 'note'; id: string; trail: string[] }

const SCREEN_KEY = 'menubar.screen'
const isTab = (v: unknown): v is Tab => v === 'today' || v === 'history' || v === 'notes'

function toStored(s: Screen): StoredScreen {
  if (s.name === 'task')
    return {
      name: 'task',
      id: s.task.id,
      from: s.from,
      parentId: s.parent?.id,
      fromList: s.fromList
    }
  if (s.name === 'note')
    return { name: 'note', id: s.note.id, trail: (s.trail ?? []).map((n) => n.id) }
  return { name: s.name }
}

function storedTab(): Tab {
  const s = uiState.get<Partial<StoredScreen> | null>(SCREEN_KEY, null)
  if (!s) return 'today'
  if (isTab(s.name)) return s.name
  if (s.name === 'task') return (s as { from?: unknown }).from === 'history' ? 'history' : 'today'
  return 'notes'
}

async function restoreDetail(s: StoredScreen | null): Promise<Screen | null> {
  try {
    if (s?.name === 'task' && typeof s.id === 'string') {
      const view = await tasksApi.get(s.id)
      const parent = s.parentId ? (await tasksApi.get(s.parentId)).task : undefined
      return { name: 'task', task: view.task, from: s.from, parent, fromList: s.fromList }
    }
    if (s?.name === 'note' && typeof s.id === 'string') {
      const note = await notesApi.get(s.id)
      const trail = (
        await Promise.all((s.trail ?? []).map((id) => notesApi.get(id).catch(() => null)))
      ).filter((n): n is Note => n !== null)
      return { name: 'note', note, trail }
    }
  } catch {
    // borrada: su pestaña
  }
  return null
}

function App(): React.JSX.Element {
  const today = useToday()
  const day = useDay(today)
  // Lo guardado se lee una vez antes de que el primer guardado lo pise.
  const [saved] = useState(() => uiState.get<StoredScreen | null>(SCREEN_KEY, null))
  const [screen, setScreen] = useState<Screen>(() => ({ name: storedTab() }))
  // Pestañas ya abiertas: se quedan montadas, así conservan filtros, scroll y lo escrito.
  const [mounted, setMounted] = useState<Set<Tab>>(() => new Set([storedTab()]))
  const [lastTab, setLastTab] = useState<Tab>(storedTab)
  const [pinned, setPinned] = useState(
    () => uiState.get<MenubarWindowState | null>(MENUBAR_WINDOW_KEY, null)?.pinned === true
  )
  const { runUndo, clearUndo, reload, remove } = day

  const onTab = screen.name === 'today' || screen.name === 'history' || screen.name === 'notes'
  // La pestaña que se ve (o la que queda debajo de un detalle).
  const tab: Tab = onTab
    ? screen.name
    : screen.name === 'note'
      ? 'notes'
      : screen.name === 'task'
        ? screen.from
        : lastTab

  // Recordar la pestaña montada y la pantalla (ui-state.json).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marcar montada la pestaña nueva
    setMounted((m) => (m.has(tab) ? m : new Set([...m, tab])))
    setLastTab(tab)
  }, [tab])
  useEffect(() => uiState.set(SCREEN_KEY, toStored(screen)), [screen])

  // Al arrancar, si lo último era una tarea o una nota, se vuelve a abrir.
  useEffect(() => {
    let alive = true
    void restoreDetail(saved).then((detail) => {
      // Si mientras tanto ya cambiaste de pantalla, no se pisa.
      if (alive && detail) setScreen((current) => (current.name === storedTab() ? detail : current))
    })
    return () => {
      alive = false
    }
  }, [saved])

  const togglePin = async (): Promise<void> => {
    try {
      setPinned((await window.api.ui.setMenubarPinned(!pinned)).pinned)
    } catch {
      // se queda como estaba
    }
  }

  const createNote = useCallback(async () => {
    try {
      setScreen({ name: 'note', note: await notesApi.create('') })
    } catch {
      // Si falla, se queda en la lista; NotesView muestra el error al recargar.
    }
  }, [])

  // ---- volver de los detalles (estables: los detalles los usan en efectos) ----

  const backFromTask = useCallback(
    (from: Tab) => {
      setScreen({ name: from })
      void reload()
    },
    [reload]
  )

  const backFromNote = useCallback((trail: Note[] = []) => {
    const previous = trail[trail.length - 1]
    setScreen(
      previous ? { name: 'note', note: previous, trail: trail.slice(0, -1) } : { name: 'notes' }
    )
  }, [])

  const openRelatedNote = useCallback(async (id: string, current: Note, trail: Note[] = []) => {
    try {
      const next = await notesApi.get(id)
      const latest = await notesApi.get(current.id).catch(() => current)
      setScreen({ name: 'note', note: next, trail: [...trail, latest] })
    } catch {
      // La nota ya no existe: se queda donde está.
    }
  }, [])

  const removeTask = useCallback(
    (task: Task, from: Tab) => {
      setScreen({ name: from })
      void remove(task) // borra con toast «Deshacer»
    },
    [remove]
  )

  const backToParent = useCallback(
    (parent: Task, from: 'today' | 'history') => setScreen({ name: 'task', task: parent, from }),
    []
  )

  // Clic en la notificación «Nota creada» (nota de voz): abrir esa nota.
  useEffect(() => window.api.onNotesOpen((note) => setScreen({ name: 'note', note })), [])

  // Atajos globales. En los detalles solo ⌘Z: Esc y ⌘E los gestiona cada pantalla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement

      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        void runUndo()
        return
      }
      if (!onTab) return

      if (mod && (e.key === '1' || e.key === '2' || e.key === '3')) {
        e.preventDefault()
        setScreen({ name: TABS[Number(e.key) - 1].id })
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (screen.name === 'notes') {
          void createNote()
        } else {
          setScreen({ name: 'today' })
          requestAnimationFrame(() => document.getElementById('capture')?.focus())
        }
      } else if (e.key === 'Escape') {
        hideWindow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runUndo, onTab, screen.name, createNote])

  const detail = !onTab

  const panel = (id: Tab, view: React.ReactNode): React.ReactNode =>
    mounted.has(id) && (
      <div
        key={id}
        inert={id !== tab || detail}
        className={`absolute inset-0 flex flex-col ${id === tab ? '' : 'invisible'}`}
      >
        {view}
      </div>
    )

  return (
    <div className="relative flex h-full flex-col">
      {/* Fijada: se arrastra desde el borde de arriba, como una ventana. */}
      {pinned && (
        <div aria-hidden className="absolute inset-x-0 top-0 z-30 h-4 [-webkit-app-region:drag]" />
      )}
      <button
        type="button"
        onClick={() => void togglePin()}
        aria-pressed={pinned}
        aria-label={pinned ? 'Soltar ventana' : 'Fijar ventana'}
        title={
          pinned
            ? 'Soltar: vuelve a ocultarse al cambiar de app'
            : 'Fijar: se queda abierta al cambiar de app y la puedes mover'
        }
        className={`absolute top-1 right-2 z-40 grid size-6 place-items-center rounded-full transition-colors hover:bg-surface [-webkit-app-region:no-drag] ${
          pinned ? 'text-apricot' : 'text-milk-faint hover:text-milk'
        }`}
      >
        {pinned ? <PinOff size={13} strokeWidth={2.5} /> : <Pin size={13} strokeWidth={2.5} />}
      </button>
      <div className="relative min-h-0 flex-1">
        {panel(
          'today',
          <TodayView
            date={today}
            day={day}
            active={screen.name === 'today'}
            onOpenTask={(task, parent) =>
              setScreen({ name: 'task', task, from: 'today', parent, fromList: Boolean(parent) })
            }
          />
        )}
        {panel(
          'history',
          <HistoryView
            today={today}
            onOpenTask={(task) => setScreen({ name: 'task', task, from: 'history' })}
          />
        )}
        {panel(
          'notes',
          <NotesView
            today={today}
            onOpen={(note) => setScreen({ name: 'note', note })}
            onCreate={() => void createNote()}
          />
        )}

        {/* Los detalles van encima de la lista: al volver, la lista sigue donde estaba. */}
        {screen.name === 'task' && (
          <div className="absolute inset-0 z-10 flex flex-col bg-night">
            <TaskDetail
              key={screen.task.id}
              task={screen.task}
              today={today}
              parent={screen.parent}
              revision={day.revision}
              backLabel={
                screen.parent && !screen.fromList
                  ? shortTitle(screen.parent.title)
                  : TAB_LABEL[screen.from]
              }
              onBack={() =>
                screen.parent && !screen.fromList
                  ? backToParent(screen.parent, screen.from)
                  : backFromTask(screen.from)
              }
              onRemove={(task) => {
                if (!screen.parent) return removeTask(task, screen.from)
                if (screen.fromList) setScreen({ name: screen.from })
                else backToParent(screen.parent, screen.from)
                void day.removeSubtask(task)
              }}
              onOpenSubtask={(sub, self) =>
                setScreen({ name: 'task', task: sub, from: screen.from, parent: self })
              }
              onRemoveSubtask={(sub) => void day.removeSubtask(sub)}
            />
          </div>
        )}
        {screen.name === 'note' && (
          <div className="absolute inset-0 z-10 flex flex-col bg-night">
            <NoteEditor
              key={screen.note.id}
              note={screen.note}
              today={today}
              backLabel={screen.trail?.length ? 'Nota anterior' : 'Notas'}
              onBack={() => backFromNote(screen.trail)}
              onOpenNote={(id) => void openRelatedNote(id, screen.note, screen.trail)}
              onOpenClient={(id) => window.api.openConsultora({ client: id })}
              scrollKey={`scroll.note:${screen.note.id}`}
            />
          </div>
        )}
      </div>

      <UndoToast undo={day.undo} onUndo={() => void runUndo()} onDone={clearUndo} />

      {onTab && (
        <nav
          aria-label="Vistas"
          className={`flex items-center justify-center gap-2 px-6 pt-2 pb-4 ${
            pinned ? '[-webkit-app-region:drag]' : ''
          }`}
        >
          <div className="flex rounded-full bg-surface p-1 [-webkit-app-region:no-drag]">
            {TABS.map(({ id, label, icon: Icon, key }) => {
              const active = screen.name === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScreen({ name: id })}
                  aria-current={active ? 'page' : undefined}
                  title={`${label} (${key})`}
                  className={`flex h-10 items-center gap-2 rounded-full px-3 text-caption font-bold transition-colors ${
                    active ? 'bg-surface-raised text-milk' : 'text-milk-soft hover:text-milk'
                  }`}
                >
                  <Icon size={16} strokeWidth={2.5} className={active ? 'text-apricot' : ''} />
                  {label}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => window.api.openConsultora()}
            aria-label="Abrir Consultora"
            title="Consultora: clientes, reuniones y pipeline"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-milk-soft transition-colors hover:bg-surface-raised hover:text-milk [-webkit-app-region:no-drag]"
          >
            <Briefcase size={17} strokeWidth={2.5} />
          </button>
        </nav>
      )}
    </div>
  )
}

function shortTitle(title: string): string {
  const plain = title.replace(/[*_`~[\]()#]/g, '').trim()
  return plain.length > 22 ? `${plain.slice(0, 21)}…` : plain
}

export default App
