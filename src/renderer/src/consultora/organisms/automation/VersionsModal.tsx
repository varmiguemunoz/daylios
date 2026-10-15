import { useCallback, useState } from 'react'
import { Modal } from '../../../ui'
import { attempt, dateTime, useLoad } from '../../lib'
import { Button, ErrorNote, Pill } from '../../ui'

const automations = window.api.automations

export function VersionsModal({
  open,
  id,
  onClose,
  onRestored
}: {
  open: boolean
  id: string
  onClose: () => void
  onRestored: () => void
}): React.JSX.Element {
  const load = useCallback(
    () => (open ? automations.versions(id) : Promise.resolve([])),
    [id, open]
  )
  const { data } = useLoad(load)
  const [error, setError] = useState<string | null>(null)

  const restore = async (versionId: string): Promise<void> => {
    const failed = await attempt(() => automations.restore(id, versionId))
    setError(failed)
    if (!failed) onRestored()
  }

  return (
    <Modal open={open} title="Versiones publicadas" onClose={onClose} size="sm">
      <p className="text-[13px] text-ob-muted">
        Restaurar copia esa versión al borrador. Para que corra, publícala de nuevo. Se guardan las
        últimas 10.
      </p>
      <ErrorNote message={error} />
      <ul className="mt-3 border-t border-ob-border">
        {(data ?? []).map((v) => (
          <li
            key={v.id}
            className="flex items-center gap-2 border-b border-ob-border py-2 text-[13px]"
          >
            <span className="w-10 font-medium text-ob-text">v{v.number}</span>
            <span className="min-w-0 flex-1 text-ob-muted">{dateTime(v.publishedAt)}</span>
            {v.current ? (
              <Pill tone="mint">En uso</Pill>
            ) : (
              <Button onClick={() => void restore(v.id)}>Restaurar</Button>
            )}
          </li>
        ))}
        {data?.length === 0 && (
          <li className="py-4 text-center text-[13px] text-ob-faint">Aún no se ha publicado.</li>
        )}
      </ul>
    </Modal>
  )
}
