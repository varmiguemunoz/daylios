import { useCallback } from 'react'
import { Laptop } from 'lucide-react'
import { useLoad, dateTime } from '../../lib'
import { ErrorNote, List } from '../../ui'
import { accountApi } from './useAccount'

export function DeviceList(): React.JSX.Element {
  const load = useCallback(() => accountApi.devices(), [])
  const { data, error } = useLoad(load)
  return (
    <>
      <ErrorNote message={error} />
      <List>
        {(data ?? []).map((d) => (
          <li key={d.id} className="flex min-h-10 items-center gap-3 px-2">
            <Laptop size={16} className="shrink-0 text-ob-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[14px] text-ob-text">{d.name}</span>
            {d.current ? (
              <span className="shrink-0 text-[12px] text-ob-link">Este Mac</span>
            ) : (
              <span className="shrink-0 text-[12px] text-ob-muted">{dateTime(d.lastSeenAt)}</span>
            )}
          </li>
        ))}
      </List>
    </>
  )
}
