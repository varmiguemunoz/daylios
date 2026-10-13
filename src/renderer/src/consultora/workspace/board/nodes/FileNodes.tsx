import { memo, useEffect, useMemo, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ExternalLink, File as FileIcon, FileText, Globe } from 'lucide-react'
import { baseName, dirName, displayName, vaultUrl } from '@shared/workspace'
import { Markdown } from '../../../../components/Markdown'
import { notesApi } from '../../../../lib/api'
import { ws } from '../../lib'
import { colorValue, type BoardNode } from '../flow'
import { useBoard } from '../context'
import { NodeChrome } from './NodeChrome'
import { TextPlaceholder, useZoomedOut } from './CardText'
import { tint } from './CardNodes'

/** Cabecera fina con el nombre del archivo, como las incrustaciones de Obsidian. */
function FileTitle({ path, onOpen }: { path: string; onOpen: () => void }): React.JSX.Element {
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

/** Imagen de la bóveda, sin marco: se ve como la imagen. */
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
})

/** Nota incrustada: título y su texto en markdown (se carga una vez; doble clic la abre). */
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

  const rendered = useMemo(
    () => (body ? <Markdown text={body} imageBase={dirName(path)} /> : null),
    [body, path]
  )

  return (
    <>
      <NodeChrome selected={selected} />
      <div
        className="ob-card ob-embed"
        style={tint(colorValue(data.canvas.color))}
        onDoubleClick={() => openPath(path)}
      >
        <FileTitle path={path} onOpen={() => openPath(path)} />
        <div className="ob-card-text min-h-0 flex-1 overflow-hidden">
          {missing ? (
            <span className="text-ob-faint">No se encontró la nota.</span>
          ) : zoomedOut ? (
            <TextPlaceholder text={body ?? ''} />
          ) : (
            <div className="ob-card-md nowheel">{rendered}</div>
          )}
        </div>
      </div>
    </>
  )
})

/** Otro archivo de la bóveda: icono y nombre; se abre con su app. */
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
        className="ob-card grid place-items-center gap-2 text-center"
        style={tint(colorValue(data.canvas.color))}
        onDoubleClick={() => openPath(path)}
      >
        <div className="flex flex-col items-center gap-2 px-4">
          <Icon size={28} className="text-ob-muted" />
          <span className="text-[14px] break-all text-ob-text">{baseName(path)}</span>
        </div>
      </div>
    </>
  )
})

/** Enlace web: dominio y la URL; se abre en el navegador (Obsidian lo incrusta, aquí no: sin iframes). */
export const LinkNode = memo(function LinkNode({
  data,
  selected
}: NodeProps<BoardNode>): React.JSX.Element {
  const url = data.canvas.url ?? ''
  const host = (() => {
    try {
      return new URL(url).host
    } catch {
      return url
    }
  })()
  return (
    <>
      <NodeChrome selected={selected} />
      <div
        className="ob-card flex flex-col justify-center gap-1 px-4"
        style={tint(colorValue(data.canvas.color))}
      >
        <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ob-text">
          <Globe size={14} className="text-ob-muted" />
          {host}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="nodrag truncate text-[13px] text-ob-accent hover:underline"
        >
          {url}
        </a>
      </div>
    </>
  )
})
