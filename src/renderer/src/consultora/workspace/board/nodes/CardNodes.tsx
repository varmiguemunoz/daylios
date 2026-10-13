import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { colorValue, type BoardNode } from '../flow'
import { NodeChrome } from './NodeChrome'
import { CardText } from './CardText'

/** Estilo de color de Obsidian: borde del color y un tinte suave de fondo. */
export const tint = (color: string | null): React.CSSProperties | undefined =>
  color
    ? {
        borderColor: color,
        background: `color-mix(in srgb, ${color} 8%, var(--color-ob-bg))`
      }
    : undefined

/** Tarjeta de texto (la de JSON Canvas). */
export const CardNode = memo(function CardNode({
  id,
  data,
  selected
}: NodeProps<BoardNode>): React.JSX.Element {
  return (
    <>
      <NodeChrome selected={selected} />
      <div className="ob-card" style={tint(colorValue(data.canvas.color))}>
        <CardText id={id} text={data.canvas.text ?? ''} placeholder="Escribe…" />
      </div>
    </>
  )
})

/** Texto suelto, sin tarjeta. */
export const TextNode = memo(function TextNode({
  id,
  data,
  selected
}: NodeProps<BoardNode>): React.JSX.Element {
  const color = colorValue(data.canvas.color)
  return (
    <>
      <NodeChrome selected={selected} minHeight={24} />
      <div className="ob-free-text" style={color ? { color } : undefined}>
        <CardText id={id} text={data.canvas.text ?? ''} placeholder="Texto" />
      </div>
    </>
  )
})

/** Forma (rectángulo, elipse o rombo) con texto centrado. Se dibuja en SVG para que escale nítida. */
export const ShapeNode = memo(function ShapeNode({
  id,
  data,
  selected,
  width,
  height
}: NodeProps<BoardNode>): React.JSX.Element {
  const color = colorValue(data.canvas.color)
  const stroke = selected ? 'var(--color-ob-accent)' : (color ?? '#4a4a4a')
  const fill = color ? `color-mix(in srgb, ${color} 8%, var(--color-ob-bg))` : 'var(--color-ob-bg)'
  const shape = data.canvas.daylios?.shape ?? 'rect'
  const w = width ?? data.canvas.width
  const h = height ?? data.canvas.height
  return (
    <>
      <NodeChrome selected={selected} />
      <div className="relative size-full">
        <svg
          className="absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {shape === 'ellipse' ? (
            <ellipse
              cx={w / 2}
              cy={h / 2}
              rx={w / 2 - 1}
              ry={h / 2 - 1}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ) : shape === 'diamond' ? (
            <polygon
              points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <rect
              x={1}
              y={1}
              width={w - 2}
              height={h - 2}
              rx={8}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div
          className={`absolute ${shape === 'diamond' ? 'inset-[22%]' : shape === 'ellipse' ? 'inset-[14%]' : 'inset-0 px-4 py-3'}`}
        >
          <CardText id={id} text={data.canvas.text ?? ''} placeholder="Texto" center />
        </div>
      </div>
    </>
  )
})
