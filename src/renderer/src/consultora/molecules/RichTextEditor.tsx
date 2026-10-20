import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Link, List } from 'lucide-react'
import { sanitizeEmailHtml } from '../../lib/email-html'

const COMMANDS = [
  { label: 'Negrita', icon: Bold, command: 'bold' },
  { label: 'Cursiva', icon: Italic, command: 'italic' },
  { label: 'Lista', icon: List, command: 'insertUnorderedList' }
]

const TOOL =
  'grid size-7 place-items-center rounded-[4px] text-ob-muted hover:bg-ob-hover hover:text-ob-text'

export function RichTextEditor({
  value,
  onChange,
  label
}: {
  value: string
  onChange: (html: string) => void
  label: string
}): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const last = useRef<string | null>(null)
  const range = useRef<Range | null>(null)
  const [linking, setLinking] = useState(false)
  const [url, setUrl] = useState('https://')

  useEffect(() => {
    if (!box.current || value === last.current) return
    box.current.innerHTML = sanitizeEmailHtml(value)
    last.current = value
  }, [value])

  const emit = (): void => {
    if (!box.current) return
    const html = sanitizeEmailHtml(box.current.innerHTML)
    last.current = html
    onChange(html)
  }

  const run = (command: string, arg?: string): void => {
    box.current?.focus()
    document.execCommand(command, false, arg)
    emit()
  }

  const startLink = (): void => {
    const selection = window.getSelection()
    range.current = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null
    setUrl('https://')
    setLinking(true)
  }

  const applyLink = (): void => {
    setLinking(false)
    const href = url.trim()
    if (!range.current || !/^(https?:\/\/.+|mailto:.+)/i.test(href)) return
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range.current)
    run('createLink', href)
  }

  return (
    <div className="rounded-[4px] border border-ob-border bg-ob-bg focus-within:border-ob-accent">
      <div className="flex items-center gap-1 border-b border-ob-border px-1.5 py-1">
        {COMMANDS.map(({ label: name, icon: Icon, command }) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(command)}
            className={TOOL}
          >
            <Icon size={15} />
          </button>
        ))}
        <button
          type="button"
          title="Enlace"
          aria-label="Enlace"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startLink}
          className={TOOL}
        >
          <Link size={15} />
        </button>
        {linking && (
          <input
            autoFocus
            value={url}
            aria-label="Dirección del enlace"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              }
              if (e.key === 'Escape') setLinking(false)
            }}
            onBlur={() => setLinking(false)}
            className="ml-1 min-w-0 flex-1 rounded-[4px] border border-ob-border bg-transparent px-2 py-0.5 text-[13px] text-ob-text outline-none focus:border-ob-accent"
          />
        )}
      </div>
      <div
        ref={box}
        role="textbox"
        aria-label={label}
        aria-multiline
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        className="min-h-40 px-3 py-2 text-[14px] leading-relaxed text-ob-text outline-none [&_a]:text-ob-link [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  )
}
