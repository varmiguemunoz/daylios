import { AlertCircle } from 'lucide-react'
import { NodeIcon } from '../../atoms/NodeIcon'

export interface NodeCounts {
  passed: number
  waiting: number
  failed: number
}

export interface NodeCardProps {
  icon: string
  kind: string
  name: string
  sentence: string
  issues: string[]
  destructive?: boolean
  selected?: boolean
  highlighted?: boolean
  dimmed?: boolean
  pill?: boolean
  counts?: NodeCounts | null
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: () => void
}

function Counts({ counts }: { counts: NodeCounts }): React.JSX.Element {
  return (
    <span className="flex items-center gap-2 text-[12px] tabular-nums">
      <span className="text-ob-muted" title="Pasaron">
        {counts.passed}
      </span>
      {counts.waiting > 0 && (
        <span className="text-ob-yellow" title="Esperando aquí">
          {counts.waiting} esperan
        </span>
      )}
      {counts.failed > 0 && (
        <span className="text-ob-red" title="Fallaron aquí">
          {counts.failed} fallaron
        </span>
      )}
    </span>
  )
}

export function NodeCard({
  icon,
  kind,
  name,
  sentence,
  issues,
  destructive,
  selected,
  highlighted,
  dimmed,
  pill,
  counts,
  onClick,
  onContextMenu,
  onDragStart,
  onDragEnd
}: NodeCardProps): React.JSX.Element {
  const ring = selected
    ? 'border-ob-accent ring-1 ring-ob-accent'
    : highlighted
      ? 'border-ob-accent/70'
      : issues.length
        ? 'border-ob-orange/60'
        : 'border-ob-border hover:border-[#4a4a4a]'
  const tone = destructive ? 'text-ob-red' : 'text-ob-link'
  const title = issues.length ? issues.join('\n') : `${kind} · ${sentence}`

  if (pill) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#4a4a4a]"
        />
        <button
          type="button"
          draggable={Boolean(onDragStart)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={onClick}
          onContextMenu={onContextMenu}
          title={title}
          className={`nodrag nopan relative flex h-8 max-w-full items-center gap-1.5 rounded-full border bg-ob-alt px-3 text-[12px] text-ob-text transition-[border-color,opacity] ${ring} ${dimmed ? 'opacity-40' : ''}`}
        >
          <NodeIcon name={icon} size={14} className="shrink-0 text-ob-yellow" />
          <span className="truncate">{sentence}</span>
          {issues.length > 0 && (
            <AlertCircle size={13} className="shrink-0 text-ob-orange" aria-label="Con errores" />
          )}
          {counts && counts.waiting > 0 && (
            <span className="text-[12px] tabular-nums text-ob-yellow">{counts.waiting}</span>
          )}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={title}
      className={`nodrag nopan flex h-full w-full flex-col justify-center gap-1 rounded-[6px] border bg-ob-bg px-3 text-left transition-[border-color,opacity] ${ring} ${dimmed ? 'opacity-40' : ''}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-[4px] bg-ob-active ${tone}`}
        >
          <NodeIcon name={icon} size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ob-text">{name}</span>
        {issues.length > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-ob-orange">
            <AlertCircle size={13} aria-hidden />
            {issues.length}
          </span>
        )}
      </span>
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] text-ob-muted">{sentence}</span>
        {counts && <Counts counts={counts} />}
      </span>
    </button>
  )
}
