import { useCallback } from 'react'
import { KIND_ICON, flattenExplorer, openItem, ws } from '../lib'
import { useLoad } from '../../lib'
import { useWorkspace } from '../context'
import { kbd } from '../../../lib/platform'

export function HomePane({ onSearch }: { onSearch: () => void }): React.JSX.Element {
  const { go, actions, folderId } = useWorkspace()
  const load = useCallback(() => ws.explorer(), [])
  const { data } = useLoad(load)
  const recent = data
    ? flattenExplorer(data)
        .filter((i) => i.kind === 'note' || i.kind === 'board')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 8)
    : []

  const link = 'block text-left text-[15px] text-ob-accent hover:underline underline-offset-4'

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-[22px] font-semibold text-ob-text">Ningún archivo abierto</h1>
        <div className="mt-5 flex flex-col gap-2.5">
          <button type="button" className={link} onClick={() => void actions.newNote(folderId)}>
            Crear una nota nueva <span className="text-ob-faint">({kbd('⌘N')})</span>
          </button>
          <button type="button" className={link} onClick={() => void actions.newBoard(folderId)}>
            Crear un board nuevo
          </button>
          <button type="button" className={link} onClick={onSearch}>
            Ir a un archivo <span className="text-ob-faint">({kbd('⌘O')})</span>
          </button>
        </div>
        {recent.length > 0 && (
          <>
            <h2 className="mt-9 mb-2 text-[13px] font-semibold text-ob-muted">Recientes</h2>
            <ul className="flex flex-col">
              {recent.map((item) => {
                const Icon = KIND_ICON[item.kind]
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item, go)}
                      className="flex h-8 w-full items-center gap-2.5 rounded-[4px] px-2 text-left text-[14px] text-ob-muted hover:bg-ob-hover hover:text-ob-text"
                    >
                      <Icon size={14} className="shrink-0 text-ob-faint" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
