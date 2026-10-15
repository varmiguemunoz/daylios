import { useRef, useState } from 'react'
import {
  FIELDS,
  str,
  type AutomationOptions,
  type ParamSpec,
  type Params,
  type SubjectType
} from '@shared/automations'
import { slugify } from '@shared/marketing'
import { EFFORTS } from '@shared/tasks'
import { INPUT } from '../../ui'
import { TagEditor } from '../../marketing-ui'
import { insertVariable, VariableMenu, type Variable } from './VariableMenu'

export interface FieldContext {
  subject: SubjectType
  options: AutomationOptions | null
  variables: Variable[]
  nodes: { id: string; name: string }[]
}

interface ParamFieldProps {
  spec: ParamSpec
  params: Params
  ctx: FieldContext
  onChange: (value: unknown) => void
}

const SELECT = `${INPUT} cursor-pointer pr-1.5`

function Choice({
  value,
  options,
  required,
  onChange,
  label
}: {
  value: string
  options: { value: string; label: string }[]
  required?: boolean
  onChange: (value: string) => void
  label: string
}): React.JSX.Element {
  const known = options.some((o) => o.value === value)
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT}
    >
      {(!required || !known) && <option value="">{required ? 'Elige…' : 'Cualquiera'}</option>}
      {!known && value && <option value={value}>{value} (ya no existe)</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function TextWithVars({
  value,
  multiline,
  vars,
  variables,
  onChange,
  label,
  type = 'text'
}: {
  value: string
  multiline?: boolean
  vars?: boolean
  variables: Variable[]
  onChange: (value: string) => void
  label: string
  type?: string
}): React.JSX.Element {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const pick = (key: string): void => onChange(insertVariable(ref.current, value, key))
  return (
    <div className="flex items-start gap-1">
      {multiline ? (
        <textarea
          ref={ref}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block min-h-24 w-full resize-y rounded-[4px] border border-ob-border bg-ob-bg px-2.5 py-2 text-[13px] leading-relaxed text-ob-text outline-none [field-sizing:content] placeholder:text-ob-faint focus:border-ob-accent"
        />
      ) : (
        <input
          ref={ref}
          aria-label={label}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        />
      )}
      {vars && <VariableMenu variables={variables} onPick={pick} />}
    </div>
  )
}

function TagInput({
  value,
  options,
  onChange,
  label
}: {
  value: string
  options: { id: string; name: string }[]
  onChange: (value: string) => void
  label: string
}): React.JSX.Element {
  const shown = options.find((t) => t.id === value)?.name ?? value
  const [draft, setDraft] = useState<string | null>(null)
  const list = `tags-${label}`
  const commit = (): void => {
    if (draft === null) return
    const match = options.find((t) => t.name.toLowerCase() === draft.trim().toLowerCase())
    onChange(match ? match.id : slugify(draft))
    setDraft(null)
  }
  return (
    <>
      <input
        aria-label={label}
        list={list}
        value={draft ?? shown}
        placeholder="Escribe o elige un tag"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={INPUT}
      />
      <datalist id={list}>
        {options.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>
    </>
  )
}

export function ParamField({ spec, params, ctx, onChange }: ParamFieldProps): React.JSX.Element {
  const value = params[spec.key]
  const text =
    typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
  const o = ctx.options
  const label = spec.label

  switch (spec.kind) {
    case 'text':
    case 'url':
      return (
        <TextWithVars
          label={label}
          value={text}
          vars={spec.vars}
          variables={ctx.variables}
          onChange={onChange}
        />
      )
    case 'markdown':
      return (
        <TextWithVars
          label={label}
          multiline
          value={text}
          vars={spec.vars}
          variables={ctx.variables}
          onChange={onChange}
        />
      )
    case 'number':
      return (
        <input
          aria-label={label}
          type="number"
          min={spec.min}
          value={text}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className={INPUT}
        />
      )
    case 'datetime':
      return (
        <input
          aria-label={label}
          type="datetime-local"
          value={text.slice(0, 16)}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        />
      )
    case 'time':
      return (
        <input
          aria-label={label}
          type="time"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        />
      )
    case 'boolean':
      return (
        <label className="flex h-8 cursor-pointer items-center gap-2 text-[13px] text-ob-text">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 accent-[var(--color-ob-accent)]"
          />
          {label}
        </label>
      )
    case 'select':
      return (
        <Choice
          label={label}
          value={text}
          required={spec.required}
          options={spec.options ?? []}
          onChange={onChange}
        />
      )
    case 'effort':
      return (
        <Choice
          label={label}
          value={text}
          options={EFFORTS.map((e) => ({ value: e, label: e[0].toUpperCase() + e.slice(1) }))}
          onChange={(v) => onChange(v || undefined)}
        />
      )
    case 'tag':
      return <TagInput label={label} value={text} options={o?.tags ?? []} onChange={onChange} />
    case 'tags': {
      const tags = Array.isArray(value) ? (value as string[]) : []
      return (
        <TagEditor
          tags={tags.map((t) => ({ slug: t, name: t }))}
          suggestions={[]}
          onAdd={(t) => onChange([...new Set([...tags, slugify(t)])])}
          onRemove={(slug) => onChange(tags.filter((t) => t !== slug))}
        />
      )
    }
    case 'pipeline':
      return (
        <Choice
          label={label}
          value={text}
          required={spec.required}
          options={(o?.pipelines ?? []).map((p) => ({ value: p.id, label: p.name }))}
          onChange={onChange}
        />
      )
    case 'stage': {
      const pipeline = str(params, 'pipeline')
      const stages = (o?.stages ?? []).filter((s) => !pipeline || s.pipelineId === pipeline)
      const pipelines = new Map((o?.pipelines ?? []).map((p) => [p.id, p.name]))
      return (
        <Choice
          label={label}
          value={text}
          required={spec.required}
          options={stages.map((s) => ({
            value: s.id,
            label: pipeline ? s.name : `${pipelines.get(s.pipelineId) ?? ''} · ${s.name}`
          }))}
          onChange={onChange}
        />
      )
    }
    case 'client':
      return (
        <Choice
          label={label}
          value={text}
          required={spec.required}
          options={(o?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))}
          onChange={onChange}
        />
      )
    case 'project': {
      const clients = new Map((o?.clients ?? []).map((c) => [c.id, c.name]))
      return (
        <Choice
          label={label}
          value={text}
          required={spec.required}
          options={(o?.projects ?? []).map((p) => ({
            value: p.id,
            label: `${clients.get(p.clientId) ?? ''} · ${p.name}`
          }))}
          onChange={onChange}
        />
      )
    }
    case 'field':
      return (
        <Choice
          label={label}
          value={text}
          required={spec.required}
          options={FIELDS[ctx.subject]
            .filter((f) => f.kind === 'date')
            .map((f) => ({ value: f.key, label: f.label }))}
          onChange={onChange}
        />
      )
    case 'node':
      return (
        <Choice
          label={label}
          value={text}
          required={spec.required}
          options={ctx.nodes.map((n) => ({ value: n.id, label: n.name }))}
          onChange={onChange}
        />
      )
    default:
      return <></>
  }
}
