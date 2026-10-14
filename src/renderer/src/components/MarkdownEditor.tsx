import { useCallback, useEffect, useRef, useState } from 'react'
import { toggleTaskLine } from '@shared/consultora'
import type { SaveStatus } from '../lib/useAutosave'
import { useIdleExit } from '../lib/useIdleExit'
import { useScrollMemory } from '../lib/ui-state'
import { Markdown } from './Markdown'

export const IDLE_MS = 10000

const EDITOR_SELECTOR = '[data-md-editor]'

export const fromMarkdownEditor = (e: KeyboardEvent): boolean =>
  e.target instanceof HTMLElement && e.target.closest(EDITOR_SELECTOR) !== null

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  status: SaveStatus
  placeholder: string

  emptyHint: string

  onCommit?: () => Promise<void>

  autoEdit?: boolean

  imageBase?: string

  onPasteFiles?: (files: File[]) => Promise<string[]>

  scrollKey?: string
}

const imagesOf = (list: FileList | null | undefined): File[] =>
  [...(list ?? [])].filter((f) => f.type.startsWith('image/'))

export function MarkdownEditor({
  value,
  onChange,
  status,
  placeholder,
  emptyHint,
  onCommit,
  autoEdit = false,
  imageBase,
  onPasteFiles,
  scrollKey
}: MarkdownEditorProps): React.JSX.Element {
  const [editing, setEditing] = useState(autoEdit)
  const reader = useRef<HTMLDivElement>(null)
  // Solo en lectura: al volver de escribir, se restaura donde estaba.
  useScrollMemory(reader, editing ? null : (scrollKey ?? null))
  const editingRef = useRef(autoEdit)
  const caret = useRef<number | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const commit = useRef(onCommit)

  useEffect(() => {
    commit.current = onCommit
  }, [onCommit])

  const enter = useCallback(() => {
    window.getSelection()?.removeAllRanges()
    editingRef.current = true
    setEditing(true)
  }, [])

  const leave = useCallback(() => {
    // Esc o el temporizador desmontan el campo y el navegador puede disparar además su blur.
    if (!editingRef.current) return
    editingRef.current = false
    if (area.current) caret.current = area.current.selectionStart
    setEditing(false)
    void commit.current?.()
  }, [])

  const { poke } = useIdleExit(editing, IDLE_MS, leave)

  // ⌘E entra a editar desde lectura.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e' && !editing) {
        e.preventDefault()
        enter()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, enter])

  // Al entrar: foco y cursor donde se dejó (o al final).
  useEffect(() => {
    const el = area.current
    if (!editing || !el) return
    const at = Math.min(caret.current ?? el.value.length, el.value.length)
    el.focus()
    el.setSelectionRange(at, at)
  }, [editing])

  const insertFiles = async (files: File[], el: HTMLTextAreaElement): Promise<void> => {
    if (!onPasteFiles || !files.length) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const snippets = await onPasteFiles(files).catch(() => [])
    if (!snippets.length) return
    const text = snippets.join('\n')
    const current = el.value
    onChange(current.slice(0, start) + text + current.slice(end))
    caret.current = start + text.length
    requestAnimationFrame(() => {
      if (area.current) area.current.setSelectionRange(caret.current ?? 0, caret.current ?? 0)
    })
    poke()
  }

  const onTextKey = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      leave()
      return
    }
    // Tab inserta dos espacios (listas anidadas) en vez de saltar de campo.
    if (e.key !== 'Tab' || e.shiftKey) return
    e.preventDefault()
    const el = e.currentTarget
    el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end')
    onChange(el.value)
    poke()
  }

  const empty = !value.trim()

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {editing ? (
        <textarea
          ref={area}
          data-md-editor=""
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            poke()
          }}
          onKeyDown={onTextKey}
          onPaste={(e) => {
            const files = imagesOf(e.clipboardData?.files)
            if (!files.length || !onPasteFiles) return
            e.preventDefault()
            void insertFiles(files, e.currentTarget)
          }}
          onDrop={(e) => {
            const files = imagesOf(e.dataTransfer?.files)
            if (!files.length || !onPasteFiles) return
            e.preventDefault()
            void insertFiles(files, e.currentTarget)
          }}
          onBlur={leave}
          placeholder={placeholder}
          aria-label="Texto en markdown"
          spellCheck
          className="scroll-area min-h-0 flex-1 resize-none bg-transparent pb-6 pl-6 text-body outline-none"
        />
      ) : (
        <div
          ref={reader}
          role="textbox"
          aria-readonly="true"
          aria-label="Texto en markdown. Doble clic o Enter para editar"
          tabIndex={0}
          onDoubleClick={enter}
          onClick={empty ? enter : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target === e.currentTarget) {
              e.preventDefault()
              enter()
            }
          }}
          title={empty ? undefined : 'Doble clic para editar (⌘E)'}
          className={`scroll-area fade-bottom min-h-0 flex-1 overflow-y-auto pb-6 pl-6 outline-none transition-colors focus-visible:bg-surface/40 ${
            empty ? 'cursor-text' : ''
          }`}
        >
          {empty ? (
            <p className="text-caption text-milk-soft">{emptyHint}</p>
          ) : (
            <Markdown
              text={value}
              imageBase={imageBase}
              onToggleTask={(line) => onChange(toggleTaskLine(value, line))}
            />
          )}
        </div>
      )}
      <SaveLabel status={status} />
    </div>
  )
}

function SaveLabel({ status }: { status: SaveStatus }): React.JSX.Element {
  return (
    <p
      aria-live="polite"
      className={`pointer-events-none absolute right-6 bottom-3 rounded-full px-3 py-1 text-micro font-semibold transition-opacity ${
        status === 'saved' ? 'opacity-0' : 'bg-surface-raised opacity-100'
      } ${status === 'error' ? 'text-coral' : 'text-milk-soft'}`}
    >
      {status === 'saving' && 'Guardando…'}
      {status === 'error' && 'No se guardó'}
    </p>
  )
}
