import { useEffect, useState } from 'react'
import {
  ACTIVITY_ENTITIES,
  ACTIVITY_VERBS,
  ENTITY_LABEL,
  VERB_LABEL,
  activityPhrase,
  type ActivityEntity,
  type ActivityEntry,
  type ActivityVerb
} from '@shared/activity'
import type { Screen } from '../../lib'
import { Select } from '../../ui'
import { ActivityItem } from '../../molecules/ActivityItem'
import { useMembers } from '../orgs/useOrgs'
import { dayLabel, groupByDay, namer } from './lib'
import { screensFor } from './open'
import { activityApi, useActivityList } from './useActivity'

const ALL = ''

export function ActivityFeed({
  active,
  onOpen
}: {
  active: boolean
  onOpen: (screens: Screen[]) => void
}): React.JSX.Element {
  const members = useMembers(true)
  const [actorId, setActorId] = useState(ALL)
  const [verb, setVerb] = useState(ALL)
  const [entity, setEntity] = useState(ALL)
  const items = useActivityList({
    actorId: actorId || null,
    verb: (verb || null) as ActivityVerb | null,
    entity: (entity || null) as ActivityEntity | null,
    limit: 300
  })
  const name = namer(members)
  const newest = items[0]?.seq ?? 0

  useEffect(() => {
    if (active) void activityApi.markSeen()
  }, [active, newest])

  const open = (e: ActivityEntry): void => {
    void screensFor(e.entity, e.entityId).then((screens) => screens && onOpen(screens))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1.5 border-b border-ob-border p-2">
        <Select
          label="Persona"
          value={actorId}
          onChange={setActorId}
          options={[
            { value: ALL, label: 'Todas las personas' },
            ...members.map((m) => ({ value: m.userId, label: m.name ?? m.email ?? 'Miembro' }))
          ]}
        />
        <div className="grid grid-cols-2 gap-1.5">
          <Select
            label="Tipo"
            value={verb}
            onChange={setVerb}
            options={[
              { value: ALL, label: 'Todo' },
              ...ACTIVITY_VERBS.map((v) => ({ value: v, label: VERB_LABEL[v] }))
            ]}
          />
          <Select
            label="Elemento"
            value={entity}
            onChange={setEntity}
            options={[
              { value: ALL, label: 'Todos' },
              ...ACTIVITY_ENTITIES.map((e) => ({ value: e, label: ENTITY_LABEL[e] }))
            ]}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!items.length && (
          <p className="px-2 py-6 text-center text-[12px] text-ob-faint">
            Sin actividad todavía. Lo que hagan los miembros aparece aquí.
          </p>
        )}
        {groupByDay(items).map((group) => (
          <section key={group.key} className="mb-3">
            <h3 className="px-2 pb-1 text-[11px] font-semibold text-ob-faint">
              {dayLabel(group.key)}
            </h3>
            {group.items.map((e) => (
              <ActivityItem
                key={e.id}
                actor={name(e.actorId)}
                phrase={activityPhrase(e, name)}
                at={e.at}
                onOpen={e.entity === 'members' && e.verb === 'joined' ? undefined : () => open(e)}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
