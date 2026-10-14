import { useMemo, type ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

export interface Column<T> {
  key: string
  label: string
  render: (row: T) => ReactNode

  width?: string
  align?: 'left' | 'right'

  hideBelow?: 'md' | 'lg'

  sortValue?: (row: T) => string | number
}

export interface TableSort {
  key: string
  dir: 'asc' | 'desc'
}

export const nextSort = (current: TableSort | null, key: string): TableSort | null =>
  current?.key !== key ? { key, dir: 'asc' } : current.dir === 'asc' ? { key, dir: 'desc' } : null

const HIDE = { md: 'hidden @2xl:table-cell', lg: 'hidden @4xl:table-cell' }

export function Table<T>({
  columns,
  rows,
  rowKey,
  onOpen,
  label,
  sort = null,
  onSort,
  rowClass
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onOpen?: (row: T) => void
  label: string

  sort?: TableSort | null
  onSort?: (sort: TableSort | null) => void

  rowClass?: (row: T) => string
}): React.JSX.Element {
  const sorted = useMemo(() => {
    const value = columns.find((c) => c.key === sort?.key)?.sortValue
    if (!sort || !value) return rows
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = value(a)
      const y = value(b)
      return (
        sign *
        (typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y)))
      )
    })
  }, [rows, columns, sort])

  return (
    <table aria-label={label} className="w-full table-fixed border-collapse text-[14px]">
      <colgroup>
        {columns.map((c) => (
          <col
            key={c.key}
            style={c.width ? { width: c.width } : undefined}
            className={c.hideBelow ? HIDE[c.hideBelow] : ''}
          />
        ))}
      </colgroup>
      <thead>
        <tr className="border-b border-ob-border">
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              aria-sort={
                sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
              }
              className={`h-7 px-2 text-[12px] font-medium text-ob-muted ${c.align === 'right' ? 'text-right' : 'text-left'} ${
                c.hideBelow ? HIDE[c.hideBelow] : ''
              }`}
            >
              {onSort && c.sortValue ? (
                <button
                  type="button"
                  onClick={() => onSort(nextSort(sort, c.key))}
                  className={`inline-flex items-center gap-1 transition-colors hover:text-ob-text ${
                    sort?.key === c.key ? 'text-ob-text' : ''
                  }`}
                >
                  {c.label}
                  {sort?.key === c.key &&
                    (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </button>
              ) : (
                c.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr
            key={rowKey(row)}
            onClick={onOpen ? () => onOpen(row) : undefined}
            className={`border-b border-ob-border ${onOpen ? 'cursor-pointer transition-colors hover:bg-ob-hover' : ''} ${rowClass?.(row) ?? ''}`}
          >
            {columns.map((c, i) => (
              <td
                key={c.key}
                className={`h-8 truncate px-2 py-1 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${
                  c.hideBelow ? HIDE[c.hideBelow] : ''
                } ${i === 0 ? 'text-ob-text' : 'text-ob-muted'}`}
              >
                {i === 0 && onOpen ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(row)
                    }}
                    className="block w-full truncate text-left outline-offset-2"
                  >
                    {c.render(row)}
                  </button>
                ) : (
                  c.render(row)
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
