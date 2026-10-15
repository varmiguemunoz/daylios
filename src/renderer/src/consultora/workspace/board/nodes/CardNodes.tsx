import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { colorValue, type BoardNode } from '../flow'
import { NodeChrome } from './NodeChrome'
import { CardText } from './CardText'
import { sameNode } from './sameNode'

export const cardProps = (
  color: string | null,
  className: string
): { className: string; style?: React.CSSProperties } =>
  color
    ? { className: `${className} ob-toned`, style: { '--ob-tone': color } as React.CSSProperties }
    : { className }

export const CardNode = memo(function CardNode({
  id,
  data,
  selected
}: NodeProps<BoardNode>): React.JSX.Element {
  return (
    <>
      <NodeChrome selected={selected} />
      <div {...cardProps(colorValue(data.canvas.color), 'ob-card')}>
        <CardText
          id={id}
          text={data.canvas.text ?? ''}
          meta={data.canvas.daylios}
          placeholder="Escribe…"
        />
      </div>
    </>
  )
}, sameNode)

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
        <CardText
          id={id}
          text={data.canvas.text ?? ''}
          meta={data.canvas.daylios}
          placeholder="Texto"
        />
      </div>
    </>
  )
}, sameNode)

export const ShapeNode = memo(function ShapeNode({
  id,
  data,
  selected,
  width,
  height
}: NodeProps<BoardNode>): React.JSX.Element {
  const color = colorValue(data.canvas.color)
  const paint: React.CSSProperties = {
    stroke: selected
      ? 'var(--color-ob-accent)'
      : color
        ? `color-mix(in srgb, ${color} 70%, transparent)`
        : 'var(--ob-canvas-color)',
    strokeWidth: selected ? 2 : 1,
    fill: color ? `color-mix(in srgb, ${color} 8%, var(--ob-canvas-bg))` : 'var(--ob-canvas-bg)'
  }
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
              style={paint}
              vectorEffect="non-scaling-stroke"
            />
          ) : shape === 'diamond' ? (
            <polygon
              points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`}
              style={paint}
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <rect
              x={1}
              y={1}
              width={w - 2}
              height={h - 2}
              rx={8}
              style={paint}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div
          className={`absolute ${shape === 'diamond' ? 'inset-[22%]' : shape === 'ellipse' ? 'inset-[14%]' : 'inset-0 px-4 py-3'}`}
        >
          <CardText
            id={id}
            text={data.canvas.text ?? ''}
            meta={data.canvas.daylios}
            placeholder="Texto"
            center
          />
        </div>
      </div>
    </>
  )
}, sameNode)
