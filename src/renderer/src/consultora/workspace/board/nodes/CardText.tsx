import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@xyflow/react'
import { withStyle, type DayliosNodeMeta } from '@shared/canvas'
import { toggleWrap, type Edit, type TextAlign, type TextStyle } from '@shared/canvas-style'
import { Markdown } from '../../../../components/Markdown'
import { useBoard, useEditing } from '../context'
import { DETAIL_ZOOM } from '../viewport'
import { textVars } from '../textStyle'
import { FormatBar } from './FormatBar'

export const useZoomedOut = (): boolean => useStore((s) => s.transform[2] < DETAIL_ZOOM)

const BAR_ALIGN: Record<TextAlign, string> = {
  left: 'items-start',
  center: 'items-center',
  right: 'items-end'
}

export const TextPlaceholder = memo(function TextPlaceholder({
  text,
  align = 'left'
}: {
  text: string
  align?: TextAlign
}): React.JSX.Element {
  const lines = text
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, 14)
  return (
    <div aria-hidden className={`flex flex-col gap-[7px] pt-1 ${BAR_ALIGN[align]}`}>
      {lines.map((l, i) => (
        <span
          key={i}
          className={`block h-[9px] rounded-[2px] ${l.trimStart().startsWith('#') ? 'bg-current opacity-55' : 'bg-current opacity-25'}`}
          style={{ width: `${Math.min(100, 18 + l.length * 2.2)}%` }}
        />
      ))}
    </div>
  )
})

const WRAP_KEYS: Record<string, string> = { b: '**', i: '*' }

export const CardText = memo(function CardText({
  id,
  text,
  meta,
  placeholder,
  center = false
}: {
  id: string
  text: string
  meta?: DayliosNodeMeta
  placeholder: string
  center?: boolean
}): React.JSX.Element {
  const { patch, base, setEditing, readOnly } = useBoard()
  const editing = useEditing(id)
  const zoomedOut = useZoomedOut()
  const [draft, setDraft] = useState<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const selection = useRef<Edit | null>(null)
  const style = meta?.style
  const vars = useMemo(() => textVars(style), [style])

  // Tarjeta recién creada: entra a escribir sola.
  useEffect(() => {
    if (!editing) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abrir el campo al crearse
    setDraft(text)
    setEditing(null)
  }, [editing, text, setEditing])

  useLayoutEffect(() => {
    const pending = selection.current
    if (!pending || !field.current) return
    selection.current = null
    field.current.setSelectionRange(pending.start, pending.end)
  }, [draft])

  const rendered = useMemo(
    () => (text.trim() ? <Markdown text={text} imageBase={base} /> : null),
    [text, base]
  )

  const commit = (): void => {
    if (draft !== null && draft !== text) patch(id, { text: draft })
    setDraft(null)
  }

  const wrap = (marker: string): void => {
    const el = field.current
    if (!el || draft === null) return
    const edit = toggleWrap(draft, el.selectionStart, el.selectionEnd, marker)
    selection.current = edit
    setDraft(edit.text)
  }

  const setStyle = (next: TextStyle): void => patch(id, { daylios: withStyle(meta, next) })

  if (draft !== null) {
    return (
      <>
        <textarea
          ref={field}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation() // ⌫ y flechas son del texto, no del lienzo
            if (e.key === 'Escape') return commit()
            const marker = (e.metaKey || e.ctrlKey) && WRAP_KEYS[e.key.toLowerCase()]
            if (!marker) return
            e.preventDefault()
            wrap(marker)
          }}
          placeholder={placeholder}
          aria-label="Texto de la tarjeta"
          style={vars}
          className={`ob-card-text nodrag nowheel size-full resize-none bg-transparent outline-none placeholder:text-ob-faint ${
            center ? 'text-center' : ''
          }`}
        />
        <FormatBar nodeId={id} style={style} onStyle={setStyle} onWrap={wrap} />
      </>
    )
  }

  return (
    <div
      onDoubleClick={(e) => {
        if (readOnly) return
        e.stopPropagation()
        setDraft(text)
      }}
      style={vars}
      className={`ob-card-text size-full overflow-hidden ${center ? 'grid place-items-center text-center' : ''}`}
    >
      {!text.trim() ? (
        <span className="text-ob-faint">{placeholder}</span>
      ) : zoomedOut ? (
        <TextPlaceholder text={text} align={style?.align ?? (center ? 'center' : 'left')} />
      ) : (
        <div className="ob-card-md nowheel">{rendered}</div>
      )}
    </div>
  )
})
