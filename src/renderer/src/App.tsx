import { useEffect, useState } from 'react'
import { History, Sun } from 'lucide-react'
import { useToday } from './lib/useToday'
import { useDay } from './lib/useDay'
import { hideWindow } from './lib/api'
import { TodayView } from './components/TodayView'
import { HistoryView } from './components/HistoryView'
import { UndoToast } from './components/UndoToast'

type View = 'today' | 'history'

const TABS: { id: View; label: string; icon: typeof Sun; key: string }[] = [
  { id: 'today', label: 'Hoy', icon: Sun, key: '⌘1' },
  { id: 'history', label: 'Historial', icon: History, key: '⌘2' }
]

function App(): React.JSX.Element {
  const today = useToday()
  const day = useDay(today)
  const [view, setView] = useState<View>('today')
  const { runUndo, clearUndo } = day

  // Atajos globales. Solo se vuelve a registrar cuando cambia `runUndo` (es decir, cuando hay otro deshacer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === '1') {
        e.preventDefault()
        setView('today')
      } else if (mod && e.key === '2') {
        e.preventDefault()
        setView('history')
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setView('today')
        requestAnimationFrame(() => document.getElementById('capture')?.focus())
      } else if (mod && e.key.toLowerCase() === 'z' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        void runUndo()
      } else if (e.key === 'Escape') {
        hideWindow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runUndo])

  return (
    <div className="relative flex h-full flex-col">
      <div className="min-h-0 flex-1">
        {view === 'today' ? <TodayView date={today} day={day} /> : <HistoryView today={today} />}
      </div>

      <UndoToast undo={day.undo} onUndo={() => void runUndo()} onDone={clearUndo} />

      <nav aria-label="Vistas" className="flex justify-center px-6 pt-2 pb-4">
        <div className="flex rounded-full bg-surface p-1">
          {TABS.map(({ id, label, icon: Icon, key }) => {
            const active = view === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-current={active ? 'page' : undefined}
                title={`${label} (${key})`}
                className={`flex h-10 items-center gap-2 rounded-full px-5 text-caption font-bold transition-colors ${
                  active ? 'bg-surface-raised text-milk' : 'text-milk-soft hover:text-milk'
                }`}
              >
                <Icon size={16} strokeWidth={2.5} className={active ? 'text-apricot' : ''} />
                {label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default App
