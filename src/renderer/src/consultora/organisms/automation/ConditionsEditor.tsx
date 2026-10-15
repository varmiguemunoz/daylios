import { Plus } from 'lucide-react'
import type { AutomationOptions, ConditionGroup, SubjectType } from '@shared/automations'
import { ConditionRow } from '../../molecules/automation/ConditionRow'

const EMPTY = { field: '', operator: 'is' as const, value: undefined }

export function ConditionsEditor({
  groups,
  subject,
  options,
  onChange,
  empty = 'Sin condiciones.'
}: {
  groups: ConditionGroup[]
  subject: SubjectType
  options: AutomationOptions | null
  onChange: (groups: ConditionGroup[]) => void
  empty?: string
}): React.JSX.Element {
  const setGroup = (i: number, group: ConditionGroup | null): void =>
    onChange(
      group === null || group.conditions.length === 0
        ? groups.filter((_, j) => j !== i)
        : groups.map((g, j) => (j === i ? group : g))
    )

  return (
    <div className="flex flex-col gap-2">
      {groups.length === 0 && <p className="text-[12px] text-ob-faint">{empty}</p>}
      {groups.map((group, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          {i > 0 && (
            <p className="text-center text-[12px] font-semibold tracking-wide text-ob-faint uppercase">
              y además
            </p>
          )}
          <div className="flex flex-col gap-1.5 rounded-[6px] border border-ob-border p-1.5">
            {group.conditions.map((condition, k) => (
              <div key={k} className="flex flex-col gap-1.5">
                {k > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setGroup(i, { ...group, join: group.join === 'and' ? 'or' : 'and' })
                    }
                    title="Cambiar entre Y y O"
                    className="self-center rounded-full bg-ob-active px-2 text-[12px] font-semibold text-ob-link hover:bg-[#3f3f3f]"
                  >
                    {group.join === 'and' ? 'Y' : 'O'}
                  </button>
                )}
                <ConditionRow
                  condition={condition}
                  subject={subject}
                  options={options}
                  onChange={(c) =>
                    setGroup(i, {
                      ...group,
                      conditions: group.conditions.map((x, j) => (j === k ? c : x))
                    })
                  }
                  onRemove={() =>
                    setGroup(i, {
                      ...group,
                      conditions: group.conditions.filter((_, j) => j !== k)
                    })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setGroup(i, { ...group, conditions: [...group.conditions, EMPTY] })}
              className="flex h-7 items-center gap-1 self-start rounded-[4px] px-2 text-[12px] text-ob-muted hover:bg-ob-active hover:text-ob-text"
            >
              <Plus size={13} aria-hidden />
              Condición
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...groups, { join: 'and', conditions: [EMPTY] }])}
        className="flex h-7 items-center gap-1 self-start rounded-[4px] px-2 text-[12px] text-ob-muted hover:bg-ob-active hover:text-ob-text"
      >
        <Plus size={13} aria-hidden />
        {groups.length ? 'Grupo de condiciones' : 'Añadir condición'}
      </button>
    </div>
  )
}
