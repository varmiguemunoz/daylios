import { X } from 'lucide-react'
import {
  CUSTOM_FIELD_PREFIX,
  FIELDS,
  fieldSpec,
  OPERATOR_LABELS,
  OPERATORS_BY_KIND,
  VALUELESS,
  type AutomationOptions,
  type Condition,
  type ConditionValue,
  type FieldSpec,
  type SubjectType
} from '@shared/automations'
import { CONTACT_STATUSES, slugify } from '@shared/marketing'
import { INPUT } from '../../ui'

const SELECT = `${INPUT} cursor-pointer pr-1.5`
const CUSTOM = '__custom__'

const STATUS_LABEL: Record<string, string> = {
  none: 'Sin marketing',
  subscribed: 'Suscrito',
  unsubscribed: 'Baja',
  bounced: 'Rebotó',
  complained: 'Spam'
}

function sourceOptions(
  field: FieldSpec,
  options: AutomationOptions | null
): { value: string; label: string }[] {
  if (field.source === 'status')
    return CONTACT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] ?? s }))
  if (field.source === 'pipeline')
    return (options?.pipelines ?? []).map((p) => ({ value: p.id, label: p.name }))
  if (field.source === 'stage')
    return (options?.stages ?? []).map((s) => ({ value: s.id, label: s.name }))
  if (field.source === 'client')
    return (options?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))
  return field.options ?? []
}

function ValueInput({
  field,
  condition,
  options,
  onChange
}: {
  field: FieldSpec
  condition: Condition
  options: AutomationOptions | null
  onChange: (value: ConditionValue) => void
}): React.JSX.Element | null {
  const op = condition.operator
  if (VALUELESS.includes(op)) return null
  const raw = condition.value
  const one = Array.isArray(raw)
    ? String(raw[0] ?? '')
    : raw === null || raw === undefined
      ? ''
      : String(raw)
  const days = op === 'within_days' || op === 'older_than_days'
  const type = days || field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'
  const cast = (v: string): string | number => (type === 'number' && v !== '' ? Number(v) : v)

  if (op === 'between') {
    const pair = Array.isArray(raw) ? raw.map(String) : ['', '']
    const set = (i: number, v: string): void => {
      const next = [pair[0] ?? '', pair[1] ?? '']
      next[i] = v
      onChange(next.map((x) => (type === 'number' && x !== '' ? String(Number(x)) : x)))
    }
    return (
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <input
          aria-label="Desde"
          type={type}
          value={pair[0] ?? ''}
          onChange={(e) => set(0, e.target.value)}
          className={INPUT}
        />
        <span className="text-[12px] text-ob-muted">y</span>
        <input
          aria-label="Hasta"
          type={type}
          value={pair[1] ?? ''}
          onChange={(e) => set(1, e.target.value)}
          className={INPUT}
        />
      </span>
    )
  }
  if (field.kind === 'boolean')
    return (
      <select
        aria-label="Valor"
        value={String(raw ?? 'true')}
        onChange={(e) => onChange(e.target.value === 'true')}
        className={SELECT}
      >
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    )
  if (
    field.kind === 'select' ||
    (field.kind === 'list' && field.source && field.source !== 'tag')
  ) {
    const list = sourceOptions(field, options)
    return (
      <select
        aria-label="Valor"
        value={one}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT}
      >
        <option value="">Elige…</option>
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  if (field.source === 'tag') {
    const id = 'condition-tags'
    const shown = options?.tags.find((t) => t.id === one)?.name ?? one
    return (
      <>
        <input
          aria-label="Tag"
          list={id}
          defaultValue={shown}
          key={one}
          onBlur={(e) => {
            const match = options?.tags.find(
              (t) => t.name.toLowerCase() === e.target.value.trim().toLowerCase()
            )
            onChange(match ? match.id : slugify(e.target.value))
          }}
          className={INPUT}
        />
        <datalist id={id}>
          {(options?.tags ?? []).map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
      </>
    )
  }
  return (
    <input
      aria-label="Valor"
      type={type}
      value={type === 'date' ? one.slice(0, 10) : one}
      placeholder={days ? 'días' : undefined}
      onChange={(e) => onChange(cast(e.target.value))}
      className={INPUT}
    />
  )
}

export function ConditionRow({
  condition,
  subject,
  options,
  onChange,
  onRemove
}: {
  condition: Condition
  subject: SubjectType
  options: AutomationOptions | null
  onChange: (condition: Condition) => void
  onRemove: () => void
}): React.JSX.Element {
  const fields = FIELDS[subject]
  const custom = condition.field.startsWith(CUSTOM_FIELD_PREFIX)
  const field = fieldSpec(subject, condition.field)
  const allowsCustom = fields.some((f) => f.key.startsWith('contact.'))
  const operators = field ? OPERATORS_BY_KIND[field.kind] : []

  const pickField = (key: string): void => {
    const next = key === CUSTOM ? `${CUSTOM_FIELD_PREFIX}` : key
    const spec = fieldSpec(subject, next || `${CUSTOM_FIELD_PREFIX}x`)
    onChange({
      field: next,
      operator: spec ? OPERATORS_BY_KIND[spec.kind][0] : 'is',
      value: undefined
    })
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-[4px] bg-ob-alt p-2">
      <div className="flex items-center gap-1.5">
        <select
          aria-label="Campo"
          value={custom ? CUSTOM : condition.field}
          onChange={(e) => pickField(e.target.value)}
          className={SELECT}
        >
          <option value="">Elige un campo…</option>
          {fields.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
          {allowsCustom && <option value={CUSTOM}>Campo personalizado…</option>}
        </select>
        <button
          type="button"
          aria-label="Quitar condición"
          onClick={onRemove}
          className="grid size-7 shrink-0 place-items-center rounded-[4px] text-ob-muted hover:bg-ob-red/15 hover:text-ob-red"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      {custom && (
        <input
          aria-label="Clave del campo"
          placeholder="clave del campo, por ejemplo origen"
          value={condition.field.slice(CUSTOM_FIELD_PREFIX.length)}
          onChange={(e) =>
            onChange({ ...condition, field: `${CUSTOM_FIELD_PREFIX}${e.target.value.trim()}` })
          }
          className={INPUT}
        />
      )}
      {field && (
        <div className="flex flex-col gap-1.5">
          <select
            aria-label="Operador"
            value={condition.operator}
            onChange={(e) =>
              onChange({ ...condition, operator: e.target.value as Condition['operator'] })
            }
            className={SELECT}
          >
            {operators.map((op) => (
              <option key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </option>
            ))}
          </select>
          <ValueInput
            field={field}
            condition={condition}
            options={options}
            onChange={(value) => onChange({ ...condition, value })}
          />
        </div>
      )}
    </div>
  )
}
