import { useEffect, useState } from 'react'
import type { AccountState } from '@shared/account'

export const accountApi = window.api.account

const INITIAL: AccountState = {
  status: 'signed-out',
  user: null,
  waitingFor: null,
  email: null,
  notice: null,
  cloudReady: false
}

export function useAccount(): AccountState {
  const [state, setState] = useState<AccountState>(INITIAL)
  useEffect(() => {
    let alive = true
    void accountApi.state().then((s) => alive && setState(s))
    const off = accountApi.onChanged(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}
