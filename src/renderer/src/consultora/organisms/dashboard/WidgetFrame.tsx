import { useId, useState, type ReactNode } from 'react'
import { ChartNoAxesColumn, Table2 } from 'lucide-react'
import { MiniTable, type MiniTableData } from '../../molecules/MiniTable'

export type WidgetState = 'loading' | 'error' | 'empty' | 'ready'

export interface WidgetFrameProps {
  title: string
  state: WidgetState
  error?: string | null
  emptyText?: string

  summary?: string

  table?: MiniTableData
  footnote?: string

  onOpen?: () => void

  toolbar?: ReactNode
  children?: ReactNode
}

export function WidgetFrame({
  title,
  state,
  error,
  emptyText = 'Sin datos en este periodo.',
  summary,
  table,
  footnote,
  onOpen,
  toolbar,
  children
}: WidgetFrameProps): React.JSX.Element {
  const [asTable, setAsTable] = useState(false)
  const summaryId = useId()
  const heading = onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className="truncate text-left text-[13px] font-medium text-ob-muted transition-colors hover:text-ob-text"
    >
      {title}
    </button>
  ) : (
    <h3 className="truncate text-[13px] font-medium text-ob-muted">{title}</h3>
  )

  return (
    <section
      aria-label={title}
      aria-describedby={summary ? summaryId : undefined}
      className="flex h-full min-h-0 flex-col rounded-[8px] border border-ob-border bg-ob-alt px-4 pt-3 pb-3.5"
    >
      <header className="mb-3 flex min-h-6 items-center justify-between gap-2">
        {heading}
        <div className="flex shrink-0 items-center gap-0.5">
          {table && state === 'ready' && (
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              aria-label={asTable ? 'Ver gráfico' : 'Ver tabla'}
              title={asTable ? 'Ver gráfico' : 'Ver tabla'}
              className="grid size-6 place-items-center rounded-[4px] text-ob-faint transition-colors hover:bg-ob-hover hover:text-ob-text"
            >
              {asTable ? <ChartNoAxesColumn size={14} /> : <Table2 size={14} />}
            </button>
          )}
          {toolbar}
        </div>
      </header>
      {summary && (
        <p id={summaryId} className="sr-only">
          {summary}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state === 'loading' && (
          <div aria-hidden className="flex flex-col gap-2">
            <span className="h-7 w-24 animate-pulse rounded-[4px] bg-ob-active" />
            <span className="h-3 w-32 animate-pulse rounded-[4px] bg-ob-active" />
          </div>
        )}
        {state === 'error' && <p className="text-[13px] text-ob-red">{error}</p>}
        {state === 'empty' && <p className="text-[13px] text-ob-muted">{emptyText}</p>}
        {state === 'ready' &&
          (asTable && table ? <MiniTable label={title} data={table} /> : children)}
      </div>
      {footnote && state === 'ready' && (
        <p className="mt-2 text-[11px] text-ob-faint">{footnote}</p>
      )}
    </section>
  )
}
