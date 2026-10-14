import { useEffect, useState } from 'react'
import type { Authorship as AuthorshipData } from '@shared/organizations'
import { memberName, orgsApi, useMembers, useOrgs } from './useOrgs'

export function Authorship({ table, id }: { table: string; id: string }): React.JSX.Element | null {
  const { active } = useOrgs()
  const inOrg = !!active.orgId
  const members = useMembers(inOrg)
  const [data, setData] = useState<AuthorshipData | null>(null)

  useEffect(() => {
    if (!inOrg) return
    let alive = true
    void orgsApi.authorship(table, id).then((a) => alive && setData(a))
    return () => {
      alive = false
    }
  }, [inOrg, table, id])

  if (!inOrg || !data || (!data.createdBy && !data.updatedBy)) return null
  const created = memberName(members, data.createdBy)
  const updated = memberName(members, data.updatedBy)
  return (
    <p className="mt-2 px-1.5 text-[12px] text-ob-faint">
      {created && `Creado por ${created}`}
      {created && updated && ' · '}
      {updated && `Cambiado por ${updated}`}
    </p>
  )
}
