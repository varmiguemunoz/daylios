import { useEffect, useState } from 'react'
import type { OrgMember, OrgsState } from '@shared/organizations'

export const orgsApi = window.api.orgs

const INITIAL: OrgsState = { active: { orgId: null, name: 'Local' }, orgs: [], notice: null }

export function useOrgs(): OrgsState {
  const [state, setState] = useState<OrgsState>(INITIAL)
  useEffect(() => {
    let alive = true
    void orgsApi.state().then((s) => alive && setState(s))
    const off = orgsApi.onChanged(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}

let members: Promise<OrgMember[]> | null = null

export function useMembers(enabled: boolean): OrgMember[] {
  const [list, setList] = useState<OrgMember[]>([])
  useEffect(() => {
    if (!enabled) return
    let alive = true
    members ??= orgsApi.members().catch(() => {
      members = null
      return []
    })
    void members.then((m) => alive && setList(m))
    return () => {
      alive = false
    }
  }, [enabled])
  return enabled ? list : []
}

export const forgetMembers = (): void => {
  members = null
}

export const memberName = (list: OrgMember[], userId: string | null): string | null => {
  if (!userId) return null
  const m = list.find((x) => x.userId === userId)
  return m ? (m.name ?? m.email ?? 'Miembro') : 'Antiguo miembro'
}
