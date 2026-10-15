import { useState } from 'react'
import { useSaveOnLeave } from '../../hooks/useSaveOnLeave'
import {
  branchesOf,
  nodeSpec,
  portsOf,
  PORT_LABELS,
  visible,
  type AutomationOptions,
  type Branch,
  type ConditionGroup,
  type Definition,
  type NodeDef,
  type Params
} from '@shared/automations'
import { ConfirmButton } from '../../../ui'
import { Button, INPUT } from '../../ui'
import { NodeIcon } from '../../atoms/NodeIcon'
import { ParamField } from '../../molecules/automation/ParamField'
import { BranchesEditor } from './BranchesEditor'
import { ConditionsEditor } from './ConditionsEditor'
import { PanelField, SidePanel } from './SidePanel'
import { upstreamNodes, variablesFor } from './variables'

export interface NodePanelProps {
  def: Definition
  node: NodeDef
  options: AutomationOptions | null
  issues: string[]
  onSave: (params: Params, name: string) => void
  onDelete: (keep: string | null) => void
  onClose: () => void
}

function portName(node: NodeDef, port: string): string {
  if (node.type === 'if_else')
    return branchesOf(node.params).find((b) => b.id === port)?.name || port
  return PORT_LABELS[port] || port
}

export function NodePanel({
  def,
  node,
  options,
  issues,
  onSave,
  onDelete,
  onClose
}: NodePanelProps): React.JSX.Element {
  const spec = nodeSpec(node.type)
  const [name, setName] = useState(node.name)
  const [params, setParams] = useState<Params>(node.params)
  const [choosing, setChoosing] = useState(false)
  const dirty = name !== node.name || JSON.stringify(params) !== JSON.stringify(node.params)
  const save = (): void => onSave(params, name.trim() || spec?.label || node.type)
  const leave = useSaveOnLeave(dirty, save)
  const cancel = (): void => {
    leave.discard()
    onClose()
  }
  const ctx = {
    subject: def.subject,
    options,
    variables: variablesFor(def, node.id),
    nodes: upstreamNodes(def, node.id)
  }
  const set = (key: string, value: unknown): void => setParams((p) => ({ ...p, [key]: value }))
  const ports = portsOf(node)
  const branched = ports.length > 1

  return (
    <SidePanel
      title={
        <span className="flex items-center gap-2">
          <NodeIcon
            name={spec?.icon ?? 'Circle'}
            size={15}
            className={spec?.destructive ? 'text-ob-red' : 'text-ob-link'}
          />
          {spec?.label ?? node.type}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <Button kind="primary" onClick={save} disabled={!dirty}>
            Guardar paso
          </Button>
          <Button onClick={cancel}>Cancelar</Button>
          <span className="flex-1" />
          {branched ? (
            <Button kind="danger" onClick={() => setChoosing(!choosing)}>
              Borrar…
            </Button>
          ) : (
            <ConfirmButton
              label="Borrar paso"
              size="sm"
              onConfirm={() => {
                leave.discard()
                onDelete(null)
              }}
            />
          )}
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
        {choosing && (
          <div className="flex flex-col gap-1.5 rounded-[6px] border border-ob-red/40 p-2">
            <p className="text-[12px] text-ob-muted">¿Qué camino conservas? El resto se borra.</p>
            {ports.map((port) => (
              <Button
                key={port}
                onClick={() => {
                  leave.discard()
                  onDelete(port)
                }}
              >
                Conservar «{portName(node, port)}»
              </Button>
            ))}
            <Button
              kind="danger"
              onClick={() => {
                leave.discard()
                onDelete('')
              }}
            >
              Borrar todas las ramas
            </Button>
          </div>
        )}
        <PanelField label="Nombre del paso">
          <input
            aria-label="Nombre del paso"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT}
          />
        </PanelField>
        {(spec?.params ?? [])
          .filter((p) => visible(p, params))
          .map((p) => (
            <PanelField key={p.key} label={`${p.label}${p.required ? '' : ' · opcional'}`}>
              {p.kind === 'branches' ? (
                <BranchesEditor
                  branches={branchesOf(params)}
                  subject={def.subject}
                  options={options}
                  onChange={(b: Branch[]) => set(p.key, b)}
                />
              ) : p.kind === 'conditions' ? (
                <ConditionsEditor
                  groups={Array.isArray(params[p.key]) ? (params[p.key] as ConditionGroup[]) : []}
                  subject={def.subject}
                  options={options}
                  onChange={(g) => set(p.key, g)}
                />
              ) : (
                <ParamField spec={p} params={params} ctx={ctx} onChange={(v) => set(p.key, v)} />
              )}
            </PanelField>
          ))}
        {(spec?.outputs.length ?? 0) > 0 && (
          <p className="text-[12px] text-ob-faint">
            Los pasos siguientes pueden usar:{' '}
            {spec!.outputs.map((o) => o.label.toLowerCase()).join(', ')}.
          </p>
        )}
      </div>
    </SidePanel>
  )
}
