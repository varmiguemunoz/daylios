import { memo } from 'react'
import { NodeToolbar, Position } from '@xyflow/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUpDown,
  Bold,
  Italic,
  Minus,
  Plus
} from 'lucide-react'
import {
  DEFAULT_LINE_HEIGHT,
  DEFAULT_SIZE,
  TEXT_FONTS,
  nextLineHeight,
  stepSize,
  type TextAlign,
  type TextFont,
  type TextStyle
} from '@shared/canvas-style'
import { fontStack } from '../textStyle'
import { kbd } from '../../../../lib/platform'

const FONT_LABEL: Record<TextFont, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono' }
const ALIGN: { align: TextAlign; label: string; Icon: typeof AlignLeft }[] = [
  { align: 'left', label: 'Alinear a la izquierda', Icon: AlignLeft },
  { align: 'center', label: 'Centrar', Icon: AlignCenter },
  { align: 'right', label: 'Alinear a la derecha', Icon: AlignRight }
]

function FormatButton({
  label,
  onPress,
  pressed,
  wide,
  children,
  style
}: {
  label: string
  onPress: () => void
  pressed?: boolean
  wide?: boolean
  children: React.ReactNode
  style?: React.CSSProperties
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onMouseDown={(e) => {
        e.preventDefault()
        onPress()
      }}
      style={style}
      className={`ob-tool ${wide ? '!flex !w-auto items-center px-2 text-[12px]' : ''}`}
    >
      {children}
    </button>
  )
}

const Divider = (): React.JSX.Element => (
  <span aria-hidden className="mx-0.5 h-5 w-px bg-ob-border" />
)

export const FormatBar = memo(function FormatBar({
  nodeId,
  style,
  onStyle,
  onWrap
}: {
  nodeId: string
  style: TextStyle | undefined
  onStyle: (style: TextStyle) => void
  onWrap: (marker: string) => void
}): React.JSX.Element {
  const current = style ?? {}
  const size = current.size ?? DEFAULT_SIZE
  const lineHeight = current.lineHeight ?? DEFAULT_LINE_HEIGHT
  const set = (change: TextStyle): void => onStyle({ ...current, ...change })
  return (
    <NodeToolbar nodeId={nodeId} isVisible position={Position.Bottom} offset={14}>
      <div role="toolbar" aria-label="Formato del texto" className="ob-menu nodrag nopan">
        <FormatButton label={kbd('Negrita · ⌘B')} onPress={() => onWrap('**')}>
          <Bold size={15} />
        </FormatButton>
        <FormatButton label={kbd('Cursiva · ⌘I')} onPress={() => onWrap('*')}>
          <Italic size={15} />
        </FormatButton>
        <Divider />
        {TEXT_FONTS.map((font) => (
          <FormatButton
            key={font}
            label={`Fuente ${FONT_LABEL[font]}`}
            onPress={() => set({ font })}
            pressed={(current.font ?? 'sans') === font}
            style={{ fontFamily: fontStack(font) }}
            wide
          >
            {FONT_LABEL[font]}
          </FormatButton>
        ))}
        <Divider />
        <FormatButton label="Texto más pequeño" onPress={() => set({ size: stepSize(size, -1) })}>
          <Minus size={14} />
        </FormatButton>
        <span className="w-7 text-center text-[12px] text-ob-muted tabular-nums" aria-live="polite">
          {size}
        </span>
        <FormatButton label="Texto más grande" onPress={() => set({ size: stepSize(size, 1) })}>
          <Plus size={14} />
        </FormatButton>
        <Divider />
        {ALIGN.map(({ align, label, Icon }) => (
          <FormatButton
            key={align}
            label={label}
            onPress={() => set({ align })}
            pressed={(current.align ?? 'left') === align}
          >
            <Icon size={15} />
          </FormatButton>
        ))}
        <FormatButton
          label={`Interlineado ${lineHeight}`}
          onPress={() => set({ lineHeight: nextLineHeight(lineHeight) })}
          wide
        >
          <ArrowUpDown size={14} />
          <span className="ml-1 tabular-nums">{lineHeight}</span>
        </FormatButton>
      </div>
    </NodeToolbar>
  )
})
