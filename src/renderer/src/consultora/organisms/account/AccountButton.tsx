import { useRef } from 'react'
import { LogOut, UserRound } from 'lucide-react'
import { useContextMenu } from '../../../ui'
import { Avatar } from './Avatar'
import { accountApi, useAccount } from './useAccount'

export function AccountButton({
  onOpenAccount
}: {
  onOpenAccount: () => void
}): React.JSX.Element | null {
  const state = useAccount()
  const menu = useContextMenu()
  const anchor = useRef<HTMLButtonElement>(null)

  if (state.status === 'expired') {
    return (
      <button
        type="button"
        onClick={onOpenAccount}
        className="flex h-6 items-center gap-1.5 rounded-full bg-ob-yellow/15 px-2.5 text-[12px] text-ob-yellow transition-colors hover:bg-ob-yellow/25"
      >
        Volver a entrar
      </button>
    )
  }
  if (state.status !== 'signed-in' || !state.user) return null
  const user = state.user

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={`Cuenta de ${user.name ?? user.email ?? 'DayliOS'}`}
        title={user.name ?? user.email ?? undefined}
        onClick={() =>
          anchor.current &&
          menu.openFrom(anchor.current, [
            { label: 'Cuenta y equipo', icon: <UserRound size={15} />, onSelect: onOpenAccount },
            null,
            {
              label: 'Cerrar sesión',
              icon: <LogOut size={15} />,
              onSelect: () => void accountApi.signOut()
            }
          ])
        }
        className="grid size-7 place-items-center rounded-full transition-colors hover:bg-ob-hover"
      >
        <Avatar user={user} />
      </button>
      {menu.element}
    </>
  )
}
