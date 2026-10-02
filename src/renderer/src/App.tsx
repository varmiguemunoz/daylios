import { useCallback, useEffect, useState } from 'react'
import { Briefcase, History, NotebookPen, Sun } from 'lucide-react'
import type { Task } from '@shared/tasks'
import type { Note } from '@shared/notes'
import { useToday } from './lib/useToday'
import { useDay } from './lib/useDay'
import { hideWindow, notesApi } from './lib/api'
import { TodayView } from './components/TodayView'
import { HistoryView } from './components/HistoryView'
import { NotesView } from './components/NotesView'
import { TaskDetail } from './components/TaskDetail'
import { NoteEditor } from './components/NoteEditor'
import { UndoToast } from './components/UndoToast'

type Tab = 'today' | 'history' | 'notes'

/**
 * Qué se ve ahora. Sin router: una sola variable.
 * Las pestañas muestran la barra inferior; los detalles no (tienen botón Atrás).
 */
type Screen =
  | { name: Tab }
  | { name: 'task'; task: Task; from: 'today' | 'history' }
  | { name: 'note'; note: Note }

const TABS: { id: Tab; label: string; icon: typeof Sun; key: string }[] = [
  { id: 'today', label: 'Hoy', icon: Sun, key: '⌘1' },
  { id: 'history', label: 'Historial', icon: History, key: '⌘2' },
  { id: 'notes', label: 'Notas', icon: NotebookPen, key: '⌘3' }
]

const TAB_LABEL: Record<Tab, string> = { today: 'Hoy', history: 'Historial', notes: 'Notas' }

function App(): React.JSX.Element {
  const today = useToday()
  const day = useDay(today)
  const [screen, setScreen] = useState<Screen>({ name: 'today' })
  const { runUndo, clearUndo, reload, remove } = day

  const onTab = screen.name === 'today' || screen.name === 'history' || screen.name === 'notes'

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

  const backFromNote = useCallback(() => setScreen({ name: 'notes' }), [])

  const removeTask = useCallback(
    (task: Task, from: Tab) => {
      setScreen({ name: from })
      void remove(task) // borra con toast «Deshacer»
    },
    [remove]
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

  return (
    <div className="relative flex h-full flex-col">
      <div className="min-h-0 flex-1">
        {screen.name === 'today' && (
          <TodayView
            date={today}
            day={day}
            onOpenTask={(task) => setScreen({ name: 'task', task, from: 'today' })}
          />
        )}
        {screen.name === 'history' && (
          <HistoryView
            today={today}
            onOpenTask={(task) => setScreen({ name: 'task', task, from: 'history' })}
          />
        )}
        {screen.name === 'notes' && (
          <NotesView
            today={today}
            onOpen={(note) => setScreen({ name: 'note', note })}
            onCreate={() => void createNote()}
          />
        )}
        {screen.name === 'task' && (
          <TaskDetail
            key={screen.task.id}
            task={screen.task}
            today={today}
            backLabel={TAB_LABEL[screen.from]}
            onBack={() => backFromTask(screen.from)}
            onRemove={(task) => removeTask(task, screen.from)}
          />
        )}
        {screen.name === 'note' && (
          <NoteEditor key={screen.note.id} note={screen.note} today={today} onBack={backFromNote} />
        )}
      </div>

      <UndoToast undo={day.undo} onUndo={() => void runUndo()} onDone={clearUndo} />

      {onTab && (
        <nav aria-label="Vistas" className="flex items-center justify-center gap-2 px-6 pt-2 pb-4">
          <div className="flex rounded-full bg-surface p-1">
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
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-milk-soft transition-colors hover:bg-surface-raised hover:text-milk"
          >
            <Briefcase size={17} strokeWidth={2.5} />
          </button>
        </nav>
      )}
    </div>
  )
}

export default App
