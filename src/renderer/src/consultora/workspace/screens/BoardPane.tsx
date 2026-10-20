import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { parseCanvas, serializeCanvas, type CanvasFile } from '@shared/canvas'
import { CONFLICT_MESSAGE, type BoardContent } from '@shared/workspace'
import { errorMessage, onDataChanged } from '../../../lib/api'
import { ws } from '../lib'
import { useWorkspace } from '../context'
import { BoardCanvas } from '../board/BoardCanvas'
import { fromFlow, toFlow } from '../board/flow'

const SAVE_MS = 500

type Status = 'saved' | 'saving' | 'error'

export function BoardPane({ id }: { id: string }): React.JSX.Element {
  const { go, setError } = useWorkspace()
  const [board, setBoard] = useState<{ content: BoardContent; canvas: CanvasFile } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const load = useCallback(async () => {
    try {
      const content = await ws.readBoard(id)
      setBoard({ content, canvas: parseCanvas(content.json) })
      setRevision((r) => r + 1)
      setFailed(null)
    } catch (e) {
      setFailed(errorMessage(e))
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState solo tras await (async)
    void load()
  }, [load])

  const editor = useRef<EditorState | null>(null)
  useEffect(() => {
    let timer: number | undefined
    const check = async (): Promise<void> => {
      const state = editor.current
      if (!state || state.busy()) return
      try {
        const content = await ws.readBoard(id)
        if (content.modifiedAt === state.version() || state.busy()) return
        setBoard({ content, canvas: parseCanvas(content.json) })
        setRevision((r) => r + 1)
      } catch {
        return
      }
    }
    const off = onDataChanged(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void check(), 400)
    })
    return () => {
      window.clearTimeout(timer)
      off()
    }
  }, [id])

  const openPath = useCallback(
    (path: string) => {
      ws.resolve(path)
        .then((item) =>
          item.kind === 'note'
            ? go({ name: 'ws-note', id: item.id })
            : item.kind === 'image'
              ? go({ name: 'ws-image', id: item.id })
              : item.kind === 'board'
                ? go({ name: 'ws-board', id: item.id })
                : ws.openExternal(item.id)
        )
        .catch((e) => setError(errorMessage(e)))
    },
    [go, setError]
  )

  if (!board) {
    return (
      <div className="flex flex-1 items-center justify-center text-[14px] text-ob-faint">
        {failed ?? ''}
      </div>
    )
  }
  return (
    <div className="relative min-h-0 flex-1">
      <BoardEditor
        key={`${board.content.item.id}-${revision}`}
        content={board.content}
        canvas={board.canvas}
        onError={setError}
        onReload={() => void load()}
        onOpenPath={openPath}
        stateRef={editor}
      />
    </div>
  )
}

interface EditorState {
  busy: () => boolean
  version: () => string | undefined
}

function BoardEditor({
  content,
  canvas,
  onError,
  onReload,
  onOpenPath,
  stateRef
}: {
  content: BoardContent
  canvas: CanvasFile
  onError: (message: string | null) => void
  onReload: () => void
  onOpenPath: (path: string) => void
  stateRef: React.MutableRefObject<EditorState | null>
}): React.JSX.Element {
  const [initial] = useState(() => toFlow(canvas))
  const [status, setStatus] = useState<Status>('saved')
  const [conflict, setConflict] = useState(false)
  const snapshot = useRef<(() => CanvasFile) | null>(null)
  const version = useRef<string | undefined>(content.modifiedAt)
  // Lo último escrito: el canvas normalizado, así abrir un board no lo reescribe.
  const saved = useRef(serializeCanvas(fromFlow(initial.nodes, initial.edges, canvas)))
  const timer = useRef<number | undefined>(undefined)
  const conflicted = useRef(false)

  const write = useCallback(
    async (force = false): Promise<void> => {
      window.clearTimeout(timer.current)
      timer.current = undefined
      const read = snapshot.current
      if (!read || (conflicted.current && !force)) return
      const json = serializeCanvas(read())
      if (json === saved.current && !force) return setStatus('saved')
      setStatus('saving')
      try {
        const result = await ws.writeBoard(
          content.item.id,
          json,
          force ? undefined : version.current
        )
        version.current = result.modifiedAt
        saved.current = json
        conflicted.current = false
        setConflict(false)
        setStatus('saved')
        onError(null)
      } catch (e) {
        const message = errorMessage(e)
        setStatus('error')
        if (message.includes(CONFLICT_MESSAGE)) {
          conflicted.current = true
          setConflict(true)
        } else onError(message)
      }
    },
    [content.item.id, onError]
  )

  const onDirty = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void write(), SAVE_MS)
  }, [write])

  const saving = useRef(false)
  useEffect(() => {
    saving.current = status === 'saving'
  }, [status])
  useEffect(() => {
    stateRef.current = {
      busy: () => timer.current !== undefined || saving.current || conflicted.current,
      version: () => version.current
    }
    return () => {
      stateRef.current = null
    }
  }, [stateRef])

  // Al salir se guarda lo pendiente.
  const writeRef = useRef(write)
  useEffect(() => {
    writeRef.current = write
  }, [write])
  useEffect(
    () => () => {
      if (timer.current !== undefined) void writeRef.current()
    },
    []
  )

  return (
    <>
      <ReactFlowProvider>
        <BoardCanvas
          path={content.item.path}
          folderId={content.item.parentId}
          initial={initial}
          base={canvas}
          onDirty={onDirty}
          snapshotRef={snapshot}
          onOpenPath={onOpenPath}
          onError={onError}
          viewportKey={`board.viewport:${content.item.id}`}
        />
      </ReactFlowProvider>
      {conflict && (
        <div
          role="alert"
          className="ob-menu absolute top-3 left-1/2 z-10 -translate-x-1/2 gap-3 px-3 py-2 text-[13px] text-ob-text"
        >
          <span>Este board cambió fuera de la app.</span>
          <button
            type="button"
            onClick={onReload}
            className="rounded-[4px] bg-ob-hover px-2.5 py-1 hover:bg-ob-active"
          >
            Recargar
          </button>
          <button
            type="button"
            onClick={() => void write(true)}
            className="rounded-[4px] bg-ob-hover px-2.5 py-1 hover:bg-ob-active"
          >
            Guardar mi versión
          </button>
        </div>
      )}
      <p
        aria-live="polite"
        className={`pointer-events-none absolute bottom-4 left-4 text-[12px] transition-opacity ${
          status === 'saved' ? 'opacity-0' : 'opacity-100'
        } ${status === 'error' && !conflict ? 'text-[#fb464c]' : 'text-ob-faint'}`}
      >
        {status === 'saving'
          ? 'Guardando…'
          : status === 'error'
            ? conflict
              ? 'Sin guardar'
              : 'No se guardó'
            : ''}
      </p>
    </>
  )
}
