import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  /** Ancho CSS de la columna («30%», «120px»). Sin él, reparte el resto. */
  width?: string
  align?: 'left' | 'right'
  /** Se oculta en paneles estrechos (por debajo de 640 o 900 px de ancho). */
  hideBelow?: 'md' | 'lg'
}

const HIDE = { md: 'hidden @2xl:table-cell', lg: 'hidden @4xl:table-cell' }

/**
 * Tabla como las vistas de Obsidian Bases: cabecera fina en gris, filas de 32 px con separador de
 * 1 px y resaltado al pasar el ratón. La primera celda es el botón de la fila (teclado y lector).
 * Necesita un `@container` por encima (Page ya lo pone).
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  onOpen,
  label
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onOpen?: (row: T) => void
  label: string
}): React.JSX.Element {
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
              className={`h-7 px-2 text-[12px] font-medium text-ob-muted ${c.align === 'right' ? 'text-right' : 'text-left'} ${
                c.hideBelow ? HIDE[c.hideBelow] : ''
              }`}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={rowKey(row)}
            onClick={onOpen ? () => onOpen(row) : undefined}
            className={`border-b border-ob-border ${onOpen ? 'cursor-pointer transition-colors hover:bg-ob-hover' : ''}`}
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
