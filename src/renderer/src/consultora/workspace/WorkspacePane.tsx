import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { Screen } from '../lib'
import { useWorkspace } from './context'
import { HomePane } from './screens/HomePane'
import { FolderPane } from './screens/FolderPane'
import { NotePane } from './screens/NotePane'
import { BoardPane } from './screens/BoardPane'
import { ImagePane } from './screens/ImagePane'

/**
 * El panel del workspace: el archivo abierto y los avisos. El marco y el explorador son de la
 * ventana. Mientras está delante, main lo sabe (el atajo global lo oculta en vez de abrirlo).
 */
export function WorkspacePane({
  screen,
  back
}: {
  screen: Screen
  back: () => void
}): React.JSX.Element {
  const { error, setError, activeId, openSwitcher } = useWorkspace()

  useEffect(() => {
    window.api.setWorkspaceActive(true)
    const onFocus = (): void => window.api.setWorkspaceActive(true)
    window.addEventListener('focus', onFocus)
    return () => {
      window.api.setWorkspaceActive(false)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return (
    <>
      {error && (
        <p
          role="alert"
          className="flex items-center gap-3 border-b border-ob-border bg-ob-red/10 px-4 py-2 text-[13px] text-ob-red"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setError(null)}
            className="text-ob-muted hover:text-ob-text"
          >
            <X size={14} />
          </button>
        </p>
      )}
      <Pane
        key={`${screen.name}:${activeId ?? ''}`}
        screen={screen}
        back={back}
        onSearch={openSwitcher}
      />
    </>
  )
}

function Pane({
  screen,
  back,
  onSearch
}: {
  screen: Screen
  back: () => void
  onSearch: () => void
}): React.JSX.Element | null {
  switch (screen.name) {
    case 'workspace':
      return screen.folder ? (
        <FolderPane folderId={screen.folder} />
      ) : (
        <HomePane onSearch={onSearch} />
      )
    case 'ws-note':
      return <NotePane id={screen.id} />
    case 'ws-board':
      return <BoardPane id={screen.id} />
    case 'ws-image':
      return <ImagePane id={screen.id} onGone={back} />
    default:
      return null
  }
}
