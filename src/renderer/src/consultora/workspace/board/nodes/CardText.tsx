import { memo, useEffect, useMemo, useState } from 'react'
import { useStore } from '@xyflow/react'
import { Markdown } from '../../../../components/Markdown'
import { useBoard } from '../context'

export const DETAIL_ZOOM = 0.45

export const useZoomedOut = (): boolean => useStore((s) => s.transform[2] < DETAIL_ZOOM)

export const TextPlaceholder = memo(function TextPlaceholder({
  text
}: {
  text: string
}): React.JSX.Element {
  const lines = text
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, 14)
  return (
    <div aria-hidden className="flex flex-col gap-[7px] pt-1">
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

export const CardText = memo(function CardText({
  id,
  text,
  placeholder,
  center = false
}: {
  id: string
  text: string
  placeholder: string
  center?: boolean
}): React.JSX.Element {
  const { patch, base, editingId, setEditing } = useBoard()
  const zoomedOut = useZoomedOut()
  const [draft, setDraft] = useState<string | null>(null)

  // Tarjeta recién creada: entra a escribir sola.
  useEffect(() => {
    if (editingId !== id) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abrir el campo al crearse
    setDraft(text)
    setEditing(null)
  }, [editingId, id, text, setEditing])

  const rendered = useMemo(
    () => (text.trim() ? <Markdown text={text} imageBase={base} /> : null),
    [text, base]
  )

  const commit = (): void => {
    if (draft !== null && draft !== text) patch(id, { text: draft })
    setDraft(null)
  }

  if (draft !== null) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation() // ⌫ y flechas son del texto, no del lienzo
          if (e.key === 'Escape') commit()
        }}
        placeholder={placeholder}
        aria-label="Texto de la tarjeta"
        className={`ob-card-text nodrag nowheel size-full resize-none bg-transparent outline-none placeholder:text-ob-faint ${
          center ? 'text-center' : ''
        }`}
      />
    )
  }

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation()
        setDraft(text)
      }}
      className={`ob-card-text size-full overflow-hidden ${center ? 'grid place-items-center text-center' : ''}`}
    >
      {!text.trim() ? (
        <span className="text-ob-faint">{placeholder}</span>
      ) : zoomedOut ? (
        <TextPlaceholder text={text} />
      ) : (
        <div className="ob-card-md nowheel">{rendered}</div>
      )}
    </div>
  )
})
