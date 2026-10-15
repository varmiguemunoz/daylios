import { memo, useEffect, useMemo, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ExternalLink, File as FileIcon, FileText, Globe } from 'lucide-react'
import { baseName, dirName, displayName, vaultUrl } from '@shared/workspace'
import { sectionOf } from '@shared/note-section'
import { Markdown } from '../../../../components/Markdown'
import { notesApi } from '../../../../lib/api'
import { ws } from '../../lib'
import { colorValue, type BoardNode } from '../flow'
import { useBoard } from '../context'
import { NodeChrome } from './NodeChrome'
import { TextPlaceholder, useZoomedOut } from './CardText'
import { cardProps } from './CardNodes'
import { sameNode } from './sameNode'

export function FileTitle({
  path,
  onOpen
}: {
  path: string
  onOpen: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Abrir"
      className="nodrag ob-file-title flex w-full min-w-0 items-center gap-1.5 text-left"
    >
      <span className="truncate">{displayName(baseName(path), 'note')}</span>
      <ExternalLink size={12} className="shrink-0 opacity-60" />
    </button>
  )
}

export const ImageNode = memo(function ImageNode({
  data,
  selected
}: NodeProps<BoardNode>): React.JSX.Element {
  const path = data.canvas.file ?? ''
  const [broken, setBroken] = useState(false)
  return (
    <>
      <NodeChrome selected={selected} />
      <div className="ob-image">
        {broken ? (
          <span className="text-[13px] text-ob-faint">No se encontró {baseName(path)}</span>
        ) : (
          <img
            src={vaultUrl(path)}
            alt={baseName(path)}
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
          />
        )}
      </div>
    </>
  )
}, sameNode)

export const NoteNode = memo(function NoteNode({
  data,
  selected
}: NodeProps<BoardNode>): React.JSX.Element {
  const { openPath } = useBoard()
  const zoomedOut = useZoomedOut()
  const path = data.canvas.file ?? ''
  const [body, setBody] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let alive = true
    ws.resolve(path)
      .then((item) => notesApi.get(item.id))
      .then((note) => {
        if (alive) setBody(note.body)
      })
      .catch(() => {
        if (alive) setMissing(true)
      })
    return () => {
      alive = false
    }
  }, [path])

  const subpath = typeof data.canvas.subpath === 'string' ? data.canvas.subpath : undefined
  const shown = useMemo(() => (body ? sectionOf(body, subpath) : ''), [body, subpath])
  const rendered = useMemo(
    () => (shown ? <Markdown text={shown} imageBase={dirName(path)} /> : null),
    [shown, path]
  )

  return (
    <>
      <NodeChrome selected={selected} />
      <div
        {...cardProps(colorValue(data.canvas.color), 'ob-card ob-embed')}
        onDoubleClick={() => openPath(path)}
      >
        <FileTitle path={path} onOpen={() => openPath(path)} />
        <div className="ob-card-text min-h-0 flex-1 overflow-hidden">
          {missing ? (
            <span className="text-ob-faint">No se encontró la nota.</span>
          ) : zoomedOut ? (
            <TextPlaceholder text={shown} />
          ) : (
            <div className="ob-card-md nowheel">{rendered}</div>
          )}
        </div>
      </div>
    </>
  )
}, sameNode)

export const FileNode = memo(function FileNode({
  data,
  selected
}: NodeProps<BoardNode>): React.JSX.Element {
  const { openPath } = useBoard()
  const path = data.canvas.file ?? ''
  const Icon = path.endsWith('.canvas') ? FileText : FileIcon
  return (
    <>
      <NodeChrome selected={selected} />
      <div
        {...cardProps(
          colorValue(data.canvas.color),
          'ob-card grid place-items-center gap-2 text-center'
        )}
        onDoubleClick={() => openPath(path)}
      >
        <div className="flex flex-col items-center gap-2 px-4">
          <Icon size={28} className="text-ob-muted" />
          <span className="text-[14px] break-all text-ob-text">{baseName(path)}</span>
        </div>
      </div>
    </>
  )
}, sameNode)

export const LinkNode = memo(function LinkNode({
  data,
  selected
}: NodeProps<BoardNode>): React.JSX.Element {
  const url = data.canvas.url ?? ''
  const zoomedOut = useZoomedOut()
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  })()
  const live = /^https:\/\//i.test(url) && !zoomedOut
  return (
    <>
      <NodeChrome selected={selected} />
      <div {...cardProps(colorValue(data.canvas.color), 'ob-card')}>
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ob-border px-3">
          <Globe size={14} className="shrink-0 text-ob-muted" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ob-text">
            {host}
          </span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Abrir en el navegador"
            aria-label="Abrir en el navegador"
            className="nodrag shrink-0 text-ob-muted hover:text-ob-text"
          >
            <ExternalLink size={14} />
          </a>
        </div>
        <div className="relative min-h-0 flex-1">
          {live ? (
            <iframe
              src={url}
              title={host}
              sandbox="allow-scripts allow-same-origin allow-forms"
              referrerPolicy="no-referrer"
              loading="lazy"
              className="nodrag nowheel size-full border-0 bg-white"
            />
          ) : (
            <div className="flex size-full items-center px-4">
              <span className="truncate text-[13px] text-ob-accent">{url}</span>
            </div>
          )}
          {!selected && <div aria-hidden className="absolute inset-0" />}
        </div>
      </div>
    </>
  )
}, sameNode)
