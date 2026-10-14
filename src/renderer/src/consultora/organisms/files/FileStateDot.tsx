import type { FileSyncState } from '@shared/files'

const STYLE: Record<Exclude<FileSyncState, 'synced'>, { className: string; label: string }> = {
  uploading: { className: 'bg-ob-accent animate-pulse', label: 'Subiendo' },
  downloading: { className: 'bg-ob-cyan animate-pulse', label: 'Descargando' },
  error: { className: 'bg-ob-red', label: 'Error al sincronizar' },
  conflict: { className: 'bg-ob-yellow', label: 'Copia de conflicto' }
}

export function FileStateDot({
  state
}: {
  state: FileSyncState | undefined
}): React.JSX.Element | null {
  if (!state || state === 'synced') return null
  const { className, label } = STYLE[state]
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`size-1.5 shrink-0 rounded-full ${className}`}
    />
  )
}
