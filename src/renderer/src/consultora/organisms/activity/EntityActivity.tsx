import { activityPhrase, type ActivityEntity } from '@shared/activity'
import { Section } from '../../ui'
import { ActivityItem } from '../../molecules/ActivityItem'
import { useMembers, useOrgs } from '../orgs/useOrgs'
import { namer } from './lib'
import { useActivityList } from './useActivity'

const shortDay = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })

export function EntityActivity({
  entity,
  id
}: {
  entity: ActivityEntity
  id: string
}): React.JSX.Element | null {
  const { active } = useOrgs()
  const members = useMembers(!!active.orgId)
  const items = useActivityList({ entity, entityId: id, limit: 30 })
  if (!active.orgId || !items.length) return null
  const name = namer(members)
  return (
    <Section title="Actividad">
      <div className="flex flex-col">
        {items.map((e) => (
          <ActivityItem
            key={e.id}
            actor={name(e.actorId)}
            phrase={`${activityPhrase(e, name)} · ${shortDay.format(new Date(e.at)).replace('.', '')}`}
            at={e.at}
          />
        ))}
      </div>
    </Section>
  )
}
