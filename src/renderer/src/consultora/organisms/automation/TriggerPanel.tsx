import { useState } from 'react'
import { useSaveOnLeave } from '../../hooks/useSaveOnLeave'
import {
  triggerSpec,
  visible,
  type AutomationOptions,
  type ConditionGroup,
  type Definition,
  type Params,
  type TriggerDef
} from '@shared/automations'
import { ConfirmButton } from '../../../ui'
import { Button } from '../../ui'
import { NodeIcon } from '../../atoms/NodeIcon'
import { ParamField } from '../../molecules/automation/ParamField'
import { ConditionsEditor } from './ConditionsEditor'
import { PanelField, SidePanel } from './SidePanel'

export function TriggerPanel({
  def,
  trigger,
  options,
  issues,
  onSave,
  onDelete,
  onClose
}: {
  def: Definition
  trigger: TriggerDef
  options: AutomationOptions | null
  issues: string[]
  onSave: (params: Params, conditions: ConditionGroup[]) => void
  onDelete: () => void
  onClose: () => void
}): React.JSX.Element {
  const spec = triggerSpec(trigger.type)
  const [params, setParams] = useState<Params>(trigger.params)
  const [conditions, setConditions] = useState<ConditionGroup[]>(trigger.conditions ?? [])
  const dirty =
    JSON.stringify(params) !== JSON.stringify(trigger.params) ||
    JSON.stringify(conditions) !== JSON.stringify(trigger.conditions ?? [])
  const leave = useSaveOnLeave(dirty, () => onSave(params, conditions))
  const cancel = (): void => {
    leave.discard()
    onClose()
  }
  const ctx = { subject: def.subject, options, variables: [], nodes: [] }

  return (
    <SidePanel
      title={
        <span className="flex items-center gap-2">
          <NodeIcon name={spec?.icon ?? 'Zap'} size={15} className="text-ob-link" />
          {spec?.label ?? trigger.type}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <Button kind="primary" onClick={() => onSave(params, conditions)} disabled={!dirty}>
            Guardar trigger
          </Button>
          <Button onClick={cancel}>Cancelar</Button>
          <span className="flex-1" />
          <ConfirmButton
            label="Quitar trigger"
            size="sm"
            onConfirm={() => {
              leave.discard()
              onDelete()
            }}
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {spec?.description && (
          <p className="text-[12px] leading-snug text-ob-muted">{spec.description}</p>
        )}
        {issues.length > 0 && (
          <ul className="rounded-[4px] border-l-2 border-ob-orange bg-ob-orange/10 px-2.5 py-2 text-[12px] text-ob-orange">
            {issues.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
        {(spec?.params ?? [])
          .filter((p) => visible(p, params))
          .map((p) => (
            <PanelField key={p.key} label={`${p.label}${p.required ? '' : ' · opcional'}`}>
              <ParamField
                spec={p}
                params={params}
                ctx={ctx}
                onChange={(v) => setParams((x) => ({ ...x, [p.key]: v }))}
              />
            </PanelField>
          ))}
        {def.subject !== 'none' && (
          <PanelField label="Filtros · solo entra si se cumple">
            <ConditionsEditor
              groups={conditions}
              subject={def.subject}
              options={options}
              onChange={setConditions}
              empty="Entra cualquiera."
            />
          </PanelField>
        )}
        <p className="text-[12px] text-ob-faint">
          Si hay varios triggers, basta con que se cumpla uno.
        </p>
      </div>
    </SidePanel>
  )
}
