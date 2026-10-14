import type { AccountUser } from '@shared/account'
import { EditableText } from '../../ui'
import { Avatar } from './Avatar'
import { accountApi } from './useAccount'

export function ProfileCard({ user }: { user: AccountUser }): React.JSX.Element {
  return (
    <div className="flex items-center gap-4 rounded-[8px] border border-ob-border bg-ob-alt px-4 py-3">
      <Avatar user={user} size="lg" />
      <div className="min-w-0 flex-1">
        <EditableText
          value={user.name ?? ''}
          placeholder="Tu nombre"
          label="Nombre"
          onSave={(name) => void accountApi.rename(name)}
          className="text-[16px] font-semibold"
        />
        <p className="truncate text-[13px] text-ob-muted">{user.email}</p>
      </div>
    </div>
  )
}
