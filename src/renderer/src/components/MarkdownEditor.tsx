import { useEffect, useState } from 'react'
import { Check, Eye, PenLine } from 'lucide-react'
import { toggleTaskLine } from '@shared/consultora'
import type { SaveStatus } from '../lib/useAutosave'
import { Markdown } from './Markdown'

type Mode = 'write' | 'view'

const MODES: { id: Mode; label: string; icon: typeof Eye }[] = [
  { id: 'write', label: 'Escribir', icon: PenLine },
  { id: 'view', label: 'Ver', icon: Eye }
]

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  status: SaveStatus
  placeholder: string
  /** Texto en modo Ver cuando no hay nada escrito. */
  emptyHint: string
}

/**
 * Editor markdown: `textarea` para escribir y vista previa para leer. Sin WYSIWYG.
 * Abre en Ver si ya hay texto, en Escribir si está vacío. ⌘E alterna. Doble clic en Ver = Escribir.
 */
export function MarkdownEditor({
  value,
  onChange,
  status,
  placeholder,
  emptyHint
}: MarkdownEditorProps): React.JSX.Element {
  const [mode, setMode] = useState<Mode>(() => (value.trim() ? 'view' : 'write'))

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setMode((m) => (m === 'write' ? 'view' : 'write'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** Tab inserta dos espacios (para listas anidadas) en vez de saltar de campo. */
  const onTextKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key !== 'Tab' || e.shiftKey) return
    e.preventDefault()
    const el = e.currentTarget
    el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end')
    onChange(el.value)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 px-6">
        <div role="radiogroup" aria-label="Modo" className="flex rounded-full bg-surface p-1">
          {MODES.map(({ id, label, icon: Icon }) => {
            const active = mode === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(id)}
                title={`${label} (⌘E)`}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-caption font-bold transition-colors ${
                  active ? 'bg-surface-raised text-milk' : 'text-milk-soft hover:text-milk'
                }`}
              >
                <Icon size={14} strokeWidth={2.5} className={active ? 'text-apricot' : ''} />
                {label}
              </button>
            )
          })}
        </div>
        <SaveLabel status={status} />
      </div>

      {mode === 'write' ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onTextKey}
          placeholder={placeholder}
          aria-label="Texto en markdown"
          spellCheck
          className="scroll-area mt-4 min-h-0 flex-1 resize-none bg-transparent pb-6 pl-6 text-body outline-none"
        />
      ) : (
        <div
          onDoubleClick={() => setMode('write')}
          className="scroll-area fade-bottom mt-4 min-h-0 flex-1 overflow-y-auto pb-6 pl-6"
        >
          {value.trim() ? (
            <Markdown text={value} onToggleTask={(line) => onChange(toggleTaskLine(value, line))} />
          ) : (
            <p className="text-caption text-milk-soft">{emptyHint}</p>
          )}
        </div>
      )}
    </div>
  )
}

function SaveLabel({ status }: { status: SaveStatus }): React.JSX.Element {
  return (
    <p aria-live="polite" className="flex items-center gap-1 text-caption font-semibold">
      {status === 'saved' && (
        <>
          <Check size={14} strokeWidth={3} className="text-mint" />
          <span className="text-milk-soft">Guardado</span>
        </>
      )}
      {status === 'saving' && <span className="text-milk-soft">Guardando…</span>}
      {status === 'error' && <span className="text-coral">No se guardó</span>}
    </p>
  )
}
