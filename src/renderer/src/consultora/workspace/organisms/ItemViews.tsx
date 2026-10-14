import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { WorkspaceItem } from '@shared/workspace'
import { shortDate } from '../../lib'
import { KIND_ICON, acceptsDrop, dragItem, itemMeta, itemUrl } from '../lib'

interface ItemViewProps {
  items: WorkspaceItem[]
  onOpen: (item: WorkspaceItem) => void

  onMenu: (item: WorkspaceItem, e: React.MouseEvent, anchor?: HTMLElement) => void

  onDropOn: (folder: WorkspaceItem, e: React.DragEvent) => void
  onDelete: (item: WorkspaceItem) => void
}

function keys(item: WorkspaceItem, props: ItemViewProps) {
  return (e: React.KeyboardEvent): void => {
    if (e.key === 'Backspace' && e.metaKey) {
      e.preventDefault()
      props.onDelete(item)
    }
  }
}

function useDrop(props: ItemViewProps): {
  over: string | null
  dropProps: (item: WorkspaceItem) => React.HTMLAttributes<HTMLElement>
} {
  const [over, setOver] = useState<string | null>(null)
  return {
    over,
    dropProps: (item) => ({
      draggable: true,
      onDragStart: (e) => dragItem(e, item.id),
      ...(item.kind === 'folder'
        ? {
            onDragOver: (e: React.DragEvent) => {
              if (!acceptsDrop(e)) return
              e.preventDefault()
              e.stopPropagation()
              setOver(item.id)
            },
            onDragLeave: () => setOver((o) => (o === item.id ? null : o)),
            onDrop: (e: React.DragEvent) => {
              e.preventDefault()
              e.stopPropagation()
              setOver(null)
              props.onDropOn(item, e)
            }
          }
        : {})
    })
  }
}

export function ItemList(props: ItemViewProps): React.JSX.Element {
  const { over, dropProps } = useDrop(props)
  return (
    <ul className="overflow-hidden rounded-[6px] border border-ob-border [&>li+li]:border-t [&>li+li]:border-ob-border">
      {props.items.map((item) => {
        const Icon = KIND_ICON[item.kind]
        return (
          <li
            key={item.id}
            className={`group flex items-center gap-1 pr-2 transition-colors hover:bg-ob-hover focus-within:bg-ob-hover ${
              over === item.id ? 'bg-ob-accent/15' : ''
            }`}
            onContextMenu={(e) => props.onMenu(item, e)}
            {...dropProps(item)}
          >
            <button
              type="button"
              onClick={() => props.onOpen(item)}
              onKeyDown={keys(item, props)}
              className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left outline-offset-[-2px]"
            >
              <Icon size={17} className="shrink-0 text-ob-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-list font-medium">{item.name}</span>
              <span className="hidden shrink-0 text-caption text-ob-muted @xl:inline">
                {itemMeta(item)}
              </span>
              <span className="w-24 shrink-0 text-right text-caption text-ob-muted tabular-nums">
                {item.kind === 'folder' ? '' : shortDate(item.updatedAt)}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Acciones de ${item.name}`}
              title="Acciones"
              onClick={(e) => props.onMenu(item, e, e.currentTarget)}
              className="grid size-7 shrink-0 place-items-center rounded-[4px] text-ob-muted opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-ob-border hover:text-ob-text focus-visible:opacity-100"
            >
              <MoreHorizontal size={16} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function ItemGrid(props: ItemViewProps): React.JSX.Element {
  const { over, dropProps } = useDrop(props)
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {props.items.map((item) => {
        const Icon = KIND_ICON[item.kind]
        return (
          <li key={item.id} onContextMenu={(e) => props.onMenu(item, e)} {...dropProps(item)}>
            <button
              type="button"
              onClick={() => props.onOpen(item)}
              onKeyDown={keys(item, props)}
              className={`flex w-full flex-col overflow-hidden rounded-md bg-ob-alt text-left transition-colors hover:bg-ob-hover focus-visible:bg-ob-hover ${
                over === item.id ? 'shadow-[inset_0_0_0_2px_var(--color-ob-accent)]' : ''
              }`}
            >
              <span className="grid h-28 place-items-center overflow-hidden bg-ob-bg/30">
                {item.kind === 'image' ? (
                  <img
                    src={itemUrl(item.id, item.updatedAt)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="size-full object-cover"
                  />
                ) : (
                  <Icon size={30} strokeWidth={1.75} className="text-ob-muted" aria-hidden />
                )}
              </span>
              <span className="px-3 pt-2 pb-2.5">
                <span className="block truncate text-caption font-medium text-ob-text">
                  {item.name}
                </span>
                <span className="block truncate text-micro text-ob-muted">{itemMeta(item)}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
