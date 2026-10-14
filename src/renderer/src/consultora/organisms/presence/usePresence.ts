import { useEffect, useState } from 'react'
import { EDIT_IDLE_MS, type PresenceState, type PresenceView } from '@shared/presence'

export const presenceApi = window.api.presence

const INITIAL: PresenceState = { enabled: false, hidden: false, members: [] }

export function usePresence(): PresenceState {
  const [state, setState] = useState<PresenceState>(INITIAL)
  useEffect(() => {
    let alive = true
    void presenceApi.state().then((s) => alive && setState(s))
    const off = presenceApi.onChanged(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}

export function usePresenceReporter(view: PresenceView | null): void {
  const entity = view?.entity ?? null
  const id = view?.id ?? null

  useEffect(() => {
    presenceApi.setView(entity && id ? { entity, id } : null)
    if (!entity) return
    let idle: ReturnType<typeof setTimeout> | null = null
    let editing = false
    const onInput = (): void => {
      if (!editing) {
        editing = true
        presenceApi.setEditing(true)
      }
      if (idle) clearTimeout(idle)
      idle = setTimeout(() => {
        editing = false
        presenceApi.setEditing(false)
      }, EDIT_IDLE_MS)
    }
    document.addEventListener('input', onInput, true)
    return () => {
      document.removeEventListener('input', onInput, true)
      if (idle) clearTimeout(idle)
      if (editing) presenceApi.setEditing(false)
    }
  }, [entity, id])
}
