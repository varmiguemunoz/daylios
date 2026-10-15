import { ExternalLink, FileWarning, LoaderCircle, RotateCw } from 'lucide-react'

export type PreviewStatus =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'large'; size: string }
  | { kind: 'error'; message: string }

const TEXT: Record<Exclude<PreviewStatus['kind'], 'loading'>, string> = {
  missing: 'No se encontró el archivo.',
  large: 'Es demasiado grande para verlo aquí.',
  error: 'No se pudo abrir.'
}

export function PreviewState({
  status,
  onRetry,
  onOpenExternal
}: {
  status: PreviewStatus
  onRetry?: () => void
  onOpenExternal?: () => void
}): React.JSX.Element {
  if (status.kind === 'loading')
    return (
      <div role="status" className="grid size-full place-items-center text-ob-faint">
        <LoaderCircle size={20} className="animate-spin" aria-label="Cargando" />
      </div>
    )
  return (
    <div
      role="status"
      className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center"
    >
      <FileWarning size={22} className="text-ob-faint" />
      <p className="text-[13px] text-ob-muted">
        {TEXT[status.kind]}
        {status.kind === 'large' && ` ${status.size}.`}
      </p>
      <div className="nodrag flex gap-1.5">
        {status.kind === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ob-tool !w-auto gap-1.5 px-2 text-[12px]"
          >
            <RotateCw size={13} />
            Reintentar
          </button>
        )}
        {status.kind !== 'missing' && onOpenExternal && (
          <button
            type="button"
            onClick={onOpenExternal}
            className="ob-tool !flex !w-auto items-center gap-1.5 px-2 text-[12px]"
          >
            <ExternalLink size={13} />
            Abrir fuera
          </button>
        )}
      </div>
    </div>
  )
}
