import type { AccountUser } from '@shared/account'

const SIZE = { sm: 'size-6 text-[10px]', lg: 'size-12 text-[16px]' }

export function Avatar({
  user,
  size = 'sm'
}: {
  user: AccountUser
  size?: keyof typeof SIZE
}): React.JSX.Element {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`${SIZE[size]} shrink-0 rounded-full object-cover`}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={`${SIZE[size]} grid shrink-0 place-items-center rounded-full bg-ob-accent/20 font-semibold text-ob-link`}
    >
      {user.initials}
    </span>
  )
}
