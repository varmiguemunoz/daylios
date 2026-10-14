import { UserRound } from 'lucide-react'
import { PropertyRow } from '../../molecules/Properties'
import { Select } from '../../ui'
import { useMembers, useOrgs } from './useOrgs'

const NONE = ''

export function AssigneeRow({
  value,
  onChange
}: {
  value: string | null
  onChange: (userId: string | null) => void
}): React.JSX.Element | null {
  const { active } = useOrgs()
  const inOrg = !!active.orgId
  const members = useMembers(inOrg)
  if (!inOrg) return null
  return (
    <PropertyRow icon={UserRound} label="Responsable">
      <Select
        label="Responsable"
        value={value ?? NONE}
        onChange={(v) => onChange(v || null)}
        options={[
          { value: NONE, label: 'Sin responsable' },
          ...members.map((m) => ({ value: m.userId, label: m.name ?? m.email ?? 'Miembro' }))
        ]}
      />
    </PropertyRow>
  )
}
