import { memo, useCallback, useState } from 'react'
import { useStore, type NodeProps } from '@xyflow/react'
import { ChevronLeft, ChevronRight, FileText, Maximize2 } from 'lucide-react'
import { ws } from '../../lib'
import { colorValue, type BoardNode } from '../flow'
import { DocPreview } from '../preview/DocPreview'
import { PdfPage } from '../preview/PdfPage'
import { PreviewState } from '../preview/PreviewState'
import { keepThumb, thumbOf } from '../preview/pdf'
import { usePdf } from '../preview/usePdf'
import { NodeChrome } from './NodeChrome'
import { cardProps } from './CardNodes'
import { useZoomedOut } from './CardText'
import { FileTitle } from './FileNodes'
import { sameNode } from './sameNode'

const openOutside = (path: string): void =>
  void ws
    .resolve(path)
    .then((item) => ws.openExternal(item.id))
    .catch(() => undefined)

function PageButton({
  label,
  onClick,
  disabled,
  children
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="ob-tool !size-7"
    >
      {children}
    </button>
  )
}

export const PdfNode = memo(function PdfNode({
  data,
  selected,
  width
}: NodeProps<BoardNode>): React.JSX.Element {
  const path = data.canvas.file ?? ''
  const zoomedOut = useZoomedOut()
  const sharp = useStore((s) => s.transform[2] >= 1)
  const { doc, status, retry } = usePdf(path, !zoomedOut)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const resolution = Math.round((width ?? data.canvas.width) * (sharp ? 2 : 1))
  const thumb = thumbOf(path)
  const keep = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (page === 1) keepThumb(path, canvas)
    },
    [page, path]
  )
  const pages = doc?.numPages ?? 0
  const current = Math.min(page, Math.max(pages, 1))

  return (
    <>
      <NodeChrome selected={selected} />
      <div
        {...cardProps(colorValue(data.canvas.color), 'ob-card ob-embed')}
        onDoubleClick={() => setExpanded(true)}
      >
        <FileTitle path={path} onOpen={() => setExpanded(true)} />
        <div className="nowheel relative min-h-0 flex-1 overflow-hidden rounded-t-[7px] bg-[#2a2a2a]">
          {zoomedOut ? (
            thumb ? (
              <img src={thumb} alt="" className="block w-full" draggable={false} />
            ) : (
              <div className="grid size-full place-items-center text-ob-faint">
                <FileText size={40} />
              </div>
            )
          ) : status ? (
            <PreviewState
              status={status}
              onRetry={retry}
              onOpenExternal={() => openOutside(path)}
            />
          ) : doc ? (
            <PdfPage doc={doc} number={current} resolution={resolution} onRendered={keep} />
          ) : null}
        </div>
        {doc && !zoomedOut && (
          <div className="nodrag flex h-9 shrink-0 items-center gap-1 border-t border-ob-border px-1.5">
            <PageButton
              label="Página anterior"
              onClick={() => setPage(current - 1)}
              disabled={current <= 1}
            >
              <ChevronLeft size={15} />
            </PageButton>
            <span className="text-[12px] text-ob-muted tabular-nums">
              {current} de {pages}
            </span>
            <PageButton
              label="Página siguiente"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages}
            >
              <ChevronRight size={15} />
            </PageButton>
            <span className="flex-1" />
            <PageButton label="Ampliar" onClick={() => setExpanded(true)}>
              <Maximize2 size={14} />
            </PageButton>
          </div>
        )}
      </div>
      {expanded && (
        <DocPreview
          path={path}
          onClose={() => setExpanded(false)}
          onOpenExternal={() => openOutside(path)}
        />
      )}
    </>
  )
}, sameNode)
