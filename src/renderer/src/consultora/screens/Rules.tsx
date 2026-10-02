import { useCallback, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Stage } from '@shared/consultora'
import type { Rule, RuleAction, RuleInput, TagRef } from '@shared/marketing'
import { api, attempt, useLoad } from '../lib'
import { Button, Empty, ErrorNote, Field, Page, Select } from '../ui'
import { TagPill } from '../marketing-ui'

const marketing = window.api.marketing

const ACTION_LABEL: Record<RuleAction['type'], string> = {
  add_tag: 'Añadir tag',
  remove_tag: 'Quitar tag',
  fire_event: 'Disparar evento',
  promote: 'Pasar a pipeline'
}

/**
 * Reglas por tag: «cuando entra el tag X → acciones». Corren en el hub al recibir un lead y en
 * la app al etiquetar a mano o desde Claude. Se leen como frases; editar abre la regla en su sitio.
 */
export function Rules(): React.JSX.Element {
  const load = useCallback(() => marketing.listRules(), [])
  const { data: rules, error: loadError } = useLoad(load)
  const tagsLoad = useCallback(() => marketing.listTags(), [])
  const { data: tags } = useLoad(tagsLoad)
  const stagesLoad = useCallback(() => api.listStages(), [])
  const { data: stages } = useLoad(stagesLoad)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    const failed = await attempt(fn)
    setError(failed)
    return !failed
  }
  const move = (i: number, j: number): void => {
    if (!rules) return
    const ids = rules.map((r) => r.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    void run(() => marketing.reorderRules(ids))
  }

  const ctx = { tags: tags ?? [], stages: stages ?? [] }

  return (
    <Page
      title="Reglas"
      meta={<span>Cuando un contacto entra en un tag, la regla hace el resto.</span>}
      actions={
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex h-9 items-center gap-1.5 rounded-full bg-apricot pr-4 pl-3 text-caption font-extrabold text-ink transition-transform active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          Nueva regla
        </button>
      }
    >
      <ErrorNote message={error ?? loadError} />

      <div className="mt-6 flex flex-col gap-2">
        {editing === 'new' && (
          <RuleEditor
            {...ctx}
            onCancel={() => setEditing(null)}
            onSave={async (input) =>
              (await run(() => marketing.createRule(input))) && setEditing(null)
            }
          />
        )}
        {rules?.length === 0 && editing !== 'new' && (
          <Empty
            title="Aún no hay reglas."
            hint="Ejemplo: cuando entra «webinar», añadir «nurture» y disparar el evento que inicia tu secuencia."
          />
        )}
        {rules?.map((rule, i) =>
          editing === rule.id ? (
            <RuleEditor
              key={rule.id}
              {...ctx}
              rule={rule}
              onCancel={() => setEditing(null)}
              onSave={async (input) =>
                (await run(() => marketing.updateRule(rule.id, input))) && setEditing(null)
              }
            />
          ) : (
            <RuleCard
              key={rule.id}
              rule={rule}
              {...ctx}
              first={i === 0}
              last={i === rules.length - 1}
              onUp={() => move(i, i - 1)}
              onDown={() => move(i, i + 1)}
              onEdit={() => setEditing(rule.id)}
              onToggle={(active) => void run(() => marketing.updateRule(rule.id, { active }))}
              onRemove={() => void run(() => marketing.removeRule(rule.id))}
            />
          )
        )}
      </div>
    </Page>
  )
}

function RuleCard({
  rule,
  tags,
  stages,
  first,
  last,
  onUp,
  onDown,
  onEdit,
  onToggle,
  onRemove
}: {
  rule: Rule
  tags: TagRef[]
  stages: Stage[]
  first: boolean
  last: boolean
  onUp: () => void
  onDown: () => void
  onEdit: () => void
  onToggle: (active: boolean) => void
  onRemove: () => void
}): React.JSX.Element {
  const [confirm, setConfirm] = useState(false)
  const tag = (slug: string): React.JSX.Element => (
    <TagPill tag={tags.find((t) => t.slug === slug) ?? { slug, name: slug }} />
  )

  return (
    <section
      aria-label={`Regla ${rule.name}`}
      className={`rounded-md bg-surface px-5 py-4 transition-opacity ${rule.active ? '' : 'opacity-60'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 truncate text-list font-bold">{rule.name}</h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <label className="mr-2 flex cursor-pointer items-center gap-1.5 text-caption font-bold text-milk-soft">
            <input
              type="checkbox"
              checked={rule.active}
              onChange={(e) => onToggle(e.target.checked)}
              className="size-4 cursor-pointer accent-[var(--color-apricot)]"
            />
            Activa
          </label>
          <IconButton label="Subir" disabled={first} onClick={onUp}>
            <ArrowUp size={15} strokeWidth={2.5} />
          </IconButton>
          <IconButton label="Bajar" disabled={last} onClick={onDown}>
            <ArrowDown size={15} strokeWidth={2.5} />
          </IconButton>
          <IconButton label="Editar" onClick={onEdit}>
            <Pencil size={15} />
          </IconButton>
          <button
            type="button"
            onClick={() => (confirm ? onRemove() : setConfirm(true))}
            onMouseLeave={() => setConfirm(false)}
            onBlur={() => setConfirm(false)}
            aria-label={confirm ? 'Confirmar: borrar regla' : 'Borrar regla'}
            className={`flex h-8 items-center justify-center rounded-full text-caption font-extrabold transition-colors ${
              confirm
                ? 'bg-rose px-3 text-ink'
                : 'w-8 text-milk-soft hover:bg-rose/15 hover:text-rose'
            }`}
          >
            {confirm ? '¿Borrar?' : <Trash2 size={15} />}
          </button>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-milk-soft">
        Cuando entra {tag(rule.triggerTag)}
        {rule.actions.map((a, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span aria-hidden>{i === 0 ? '→' : '·'}</span>
            {a.type === 'add_tag' && <>añadir {tag(a.tag)}</>}
            {a.type === 'remove_tag' && <>quitar {tag(a.tag)}</>}
            {a.type === 'fire_event' && (
              <>
                disparar <span className="font-mono text-micro text-milk">{a.event}</span>
              </>
            )}
            {a.type === 'promote' && (
              <>
                pasar a pipeline en{' '}
                <span className="font-bold text-milk">
                  {stages.find((s) => s.id === a.stage)?.name ?? 'la primera etapa'}
                </span>
              </>
            )}
          </span>
        ))}
      </p>
    </section>
  )
}

/** Editor en el sitio: nombre, tag disparador y lista de acciones. */
function RuleEditor({
  rule,
  tags,
  stages,
  onSave,
  onCancel
}: {
  rule?: Rule
  tags: TagRef[]
  stages: Stage[]
  onSave: (input: RuleInput) => Promise<unknown>
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState(rule?.name ?? '')
  const [trigger, setTrigger] = useState(rule?.triggerTag ?? '')
  const [actions, setActions] = useState<RuleAction[]>(
    rule?.actions ?? [{ type: 'add_tag', tag: '' }]
  )
  const [saving, setSaving] = useState(false)

  const setAction = (i: number, action: RuleAction): void =>
    setActions(actions.map((a, j) => (j === i ? action : a)))
  const blank = (type: RuleAction['type']): RuleAction =>
    type === 'fire_event'
      ? { type, event: '' }
      : type === 'promote'
        ? { type, stage: '' }
        : { type, tag: '' }

  const input = 'w-full bg-transparent text-list outline-none placeholder:text-milk-soft'
  const openStages = stages.filter((s) => s.kind === 'open')

  return (
    <form
      className="rounded-md bg-surface px-5 py-4 shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--color-apricot)_40%,transparent)]"
      onSubmit={(e) => {
        e.preventDefault()
        setSaving(true)
        void onSave({
          name: name || `Cuando entra ${trigger}`,
          triggerTag: trigger,
          actions
        }).finally(() => setSaving(false))
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nombre">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seguimiento del webinar"
            className={input}
          />
        </Field>
        <Field label="Cuando entra el tag">
          <input
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            list="rule-tags"
            placeholder="webinar"
            className={input}
          />
        </Field>
      </div>

      <p className="mt-4 mb-1.5 px-1 text-micro font-bold text-milk-soft">Entonces</p>
      <ul className="flex flex-col gap-1.5">
        {actions.map((a, i) => (
          <li key={i} className="flex items-center gap-2 rounded-sm bg-night py-1.5 pr-1.5 pl-2">
            <Select
              label="Acción"
              value={a.type}
              options={Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label }))}
              onChange={(type) => setAction(i, blank(type as RuleAction['type']))}
            />
            <div className="min-w-0 flex-1 px-1">
              {(a.type === 'add_tag' || a.type === 'remove_tag') && (
                <input
                  value={a.tag}
                  onChange={(e) => setAction(i, { ...a, tag: e.target.value })}
                  list="rule-tags"
                  placeholder="nombre del tag"
                  aria-label="Tag"
                  className={input}
                />
              )}
              {a.type === 'fire_event' && (
                <input
                  value={a.event}
                  onChange={(e) => setAction(i, { ...a, event: e.target.value })}
                  placeholder="webinar.followup (el evento que dispara tu secuencia en Resend)"
                  aria-label="Evento"
                  spellCheck={false}
                  className={`${input} font-mono text-caption`}
                />
              )}
              {a.type === 'promote' && (
                <Select
                  label="Etapa"
                  value={a.stage}
                  options={[
                    { value: '', label: 'Primera etapa' },
                    ...openStages.map((s) => ({ value: s.id, label: s.name }))
                  ]}
                  onChange={(stage) => setAction(i, { ...a, stage })}
                />
              )}
            </div>
            <IconButton
              label="Quitar acción"
              danger
              onClick={() => setActions(actions.filter((_, j) => j !== i))}
            >
              <X size={15} strokeWidth={2.5} />
            </IconButton>
          </li>
        ))}
      </ul>
      <datalist id="rule-tags">
        {tags.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
          </option>
        ))}
      </datalist>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          onClick={() => setActions([...actions, blank('add_tag')])}
          disabled={actions.length >= 10}
        >
          <Plus size={15} strokeWidth={3} />
          Añadir acción
        </Button>
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancelar</Button>
          <button
            type="submit"
            disabled={saving || !trigger.trim() || actions.length === 0}
            className="flex h-9 items-center rounded-full bg-apricot px-4 text-caption font-extrabold text-ink transition-transform active:scale-95 disabled:bg-surface-raised disabled:text-milk-faint"
          >
            {rule ? 'Guardar regla' : 'Crear regla'}
          </button>
        </div>
      </div>
    </form>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 shrink-0 place-items-center rounded-full text-milk-soft disabled:text-milk-faint ${
        danger
          ? 'hover:bg-rose/15 hover:text-rose'
          : 'hover:bg-hairline hover:text-milk disabled:hover:bg-transparent'
      }`}
    >
      {children}
    </button>
  )
}
