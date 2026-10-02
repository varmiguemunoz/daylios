import { useCallback, useState } from 'react'
import {
  ArrowRightLeft,
  CircleAlert,
  Mail,
  MailX,
  Tag as TagIcon,
  Trash2,
  UserPlus,
  Waypoints
} from 'lucide-react'
import type { ContactInput } from '@shared/consultora'
import { STATUS_LABELS, contactLabel, type ContactEvent } from '@shared/marketing'
import { api, attempt, dateTime, shortDate, useLoad, type Go } from '../lib'
import {
  Button,
  EditableText,
  Empty,
  ErrorNote,
  Field,
  List,
  MarkdownField,
  MeetingStatusPill,
  Page,
  Row,
  Section,
  Select
} from '../ui'
import { ContactStatusPill, TagEditor } from '../marketing-ui'

/**
 * Ficha de contacto: datos, empresa, email marketing (suscripción, tags, pipeline),
 * campos del formulario, notas, actividad y reuniones donde aparece.
 */
export function Contact({
  id,
  go,
  back,
  backLabel
}: {
  id: string
  go: Go
  back: () => void
  backLabel: string
}): React.JSX.Element {
  const load = useCallback(() => api.getContact(id), [id])
  const { data: c, error: loadError } = useLoad(load)
  const refsLoad = useCallback(() => api.refs(), [])
  const { data: refs } = useLoad(refsLoad)
  const tagsLoad = useCallback(() => window.api.marketing.listTags(), [])
  const { data: allTags } = useLoad(tagsLoad)
  const stagesLoad = useCallback(() => api.listStages(), [])
  const { data: stages } = useLoad(stagesLoad)

  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmSubscribe, setConfirmSubscribe] = useState(false)
  const [stage, setStage] = useState('')

  const run = async (fn: () => Promise<unknown>): Promise<void> => setError(await attempt(fn))
  const save = (patch: ContactInput): Promise<void> => run(() => api.updateContact(id, patch))

  if (loadError?.includes('No existe ese contacto')) {
    return (
      <Page back={{ label: backLabel, onClick: back }} title="Contacto no disponible">
        <p className="mt-4 text-caption text-milk-soft">Este contacto ya no existe.</p>
      </Page>
    )
  }
  if (!c)
    return (
      <Page back={{ label: backLabel, onClick: back }} title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  const remove = async (): Promise<void> => {
    if (!confirmDelete) return setConfirmDelete(true)
    const failed = await attempt(() => api.removeContact(id))
    if (failed) setError(failed)
    else back()
  }

  const subscribe = async (): Promise<void> => {
    if (!confirmSubscribe) return setConfirmSubscribe(true)
    setConfirmSubscribe(false)
    await run(() => api.subscribeContact(id))
  }

  const input = 'bg-transparent text-list outline-none placeholder:text-milk-soft'
  const text = (
    field: 'role' | 'email' | 'phone' | 'linkedin',
    label: string,
    placeholder: string
  ): React.JSX.Element => (
    <Field label={label}>
      <input
        key={`${field}-${c[field]}`}
        defaultValue={c[field] ?? ''}
        placeholder={placeholder}
        onBlur={(e) =>
          e.target.value !== (c[field] ?? '') &&
          void save({ [field]: e.target.value } as ContactInput)
        }
        spellCheck={false}
        className={input}
      />
    </Field>
  )

  const fields = Object.entries(c.fields)
  const canSubscribe = c.status === 'none' || c.status === 'unsubscribed'

  return (
    <Page
      back={{ label: backLabel, onClick: back }}
      title={
        <EditableText
          value={c.name ?? ''}
          placeholder={c.email ?? 'Sin nombre'}
          label="Nombre"
          onSave={(name) => void save({ name })}
        />
      }
      meta={
        <>
          {c.clientId ? (
            <button
              type="button"
              onClick={() => go({ name: 'client', id: c.clientId! })}
              className="font-bold text-milk hover:text-apricot"
            >
              {c.organization}
            </button>
          ) : c.prospectId ? (
            <button
              type="button"
              onClick={() => go({ name: 'prospect', id: c.prospectId! })}
              className="font-bold text-milk hover:text-apricot"
            >
              {c.organization} · prospecto
            </button>
          ) : (
            <span>Sin empresa</span>
          )}
          <ContactStatusPill status={c.status} />
        </>
      }
      actions={
        <button
          type="button"
          onClick={() => void remove()}
          onMouseLeave={() => setConfirmDelete(false)}
          onBlur={() => setConfirmDelete(false)}
          aria-label={confirmDelete ? 'Confirmar: borrar contacto' : 'Borrar contacto'}
          className={`flex h-9 items-center justify-center rounded-full text-caption font-extrabold transition-colors ${
            confirmDelete
              ? 'bg-rose px-4 text-ink'
              : 'w-9 text-milk-soft hover:bg-rose/15 hover:text-rose'
          }`}
        >
          {confirmDelete ? '¿Borrar?' : <Trash2 size={16} />}
        </button>
      }
    >
      <ErrorNote message={error} />

      <div className="mt-6 grid grid-cols-2 gap-2">
        {text('role', 'Rol', 'CTO, dueño, compras…')}
        {text('email', 'Email', 'nombre@empresa.com')}
        {text('phone', 'Teléfono', '+1 …')}
        {text('linkedin', 'LinkedIn', 'linkedin.com/in/…')}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Select
          label="Cliente"
          value={c.clientId ?? ''}
          options={[
            { value: '', label: 'Sin cliente' },
            ...(refs?.clients ?? []).map((x) => ({ value: x.id, label: x.name }))
          ]}
          onChange={(client) => void save({ client })}
        />
        <Select
          label="Prospecto"
          value={c.prospectId ?? ''}
          options={[
            { value: '', label: 'Sin prospecto' },
            ...(refs?.prospects ?? []).map((x) => ({ value: x.id, label: x.company }))
          ]}
          onChange={(prospect) => void save({ prospect })}
        />
      </div>

      <Section title="Email marketing">
        <div className="rounded-md bg-surface px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-list font-bold">{STATUS_LABELS[c.status]}</p>
              <p className="mt-0.5 text-caption text-milk-soft">{consentLine(c)}</p>
            </div>
            {c.status === 'subscribed' && (
              <Button onClick={() => void run(() => api.unsubscribeContact(id))}>
                <MailX size={15} />
                Dar de baja
              </Button>
            )}
            {canSubscribe && (
              <button
                type="button"
                onClick={() => void subscribe()}
                onMouseLeave={() => setConfirmSubscribe(false)}
                onBlur={() => setConfirmSubscribe(false)}
                disabled={!c.email}
                title={c.email ? undefined : 'Añade un email primero'}
                className="flex h-9 items-center gap-1.5 rounded-full bg-apricot px-4 text-caption font-extrabold text-ink transition-transform active:scale-95 disabled:bg-surface-raised disabled:text-milk-faint"
              >
                <Mail size={15} />
                {confirmSubscribe ? '¿Te dio su permiso? Suscribir' : 'Suscribir'}
              </button>
            )}
          </div>
          {c.syncError && (
            <p role="alert" className="mt-3 flex items-start gap-2 text-caption text-coral">
              <CircleAlert size={15} className="mt-px shrink-0" aria-hidden />
              No se pudo sincronizar con Resend: {c.syncError}. Se reintenta solo.
            </p>
          )}
        </div>

        <div className="mt-2">
          <TagEditor
            tags={c.tags}
            suggestions={allTags ?? []}
            onAdd={(tag) => void run(() => api.tagContact(id, { add: [tag] }))}
            onRemove={(slug) => void run(() => api.tagContact(id, { remove: [slug] }))}
          />
        </div>

        {!c.prospectId && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select
              label="Etapa"
              value={stage}
              options={[
                { value: '', label: 'Primera etapa' },
                ...(stages ?? [])
                  .filter((s) => s.kind === 'open')
                  .map((s) => ({ value: s.id, label: s.name }))
              ]}
              onChange={setStage}
            />
            <Button
              onClick={() =>
                void run(async () => {
                  const { prospect } = await api.promoteContact(id, stage || undefined)
                  go({ name: 'prospect', id: prospect.id })
                })
              }
            >
              <ArrowRightLeft size={15} />
              Pasar a pipeline
            </Button>
          </div>
        )}
      </Section>

      {fields.length > 0 && (
        <Section title="Datos del formulario">
          <List>
            {fields.map(([key, value]) => (
              <Row key={key}>
                <span className="w-40 shrink-0 truncate text-caption font-bold text-milk-soft">
                  {key}
                </span>
                <span className="min-w-0 flex-1 text-list break-words">
                  {value === null ? '—' : String(value)}
                </span>
              </Row>
            ))}
          </List>
        </Section>
      )}

      <Section title="Notas">
        <MarkdownField
          value={c.notesMd}
          placeholder="Cómo prefiere comunicarse, qué le importa, historia con nosotros…"
          onSave={(notesMd) => void save({ notesMd })}
        />
      </Section>

      {c.events.length > 0 && (
        <Section title="Actividad">
          <List>
            {c.events.map((e) => {
              const { icon: Icon, text: line, tone } = describe(e)
              return (
                <Row key={e.id}>
                  <Icon size={15} className={`shrink-0 ${tone}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-list">{line}</span>
                  <span className="shrink-0 text-caption text-milk-soft tabular-nums">
                    {dateTime(e.createdAt)}
                  </span>
                </Row>
              )
            })}
          </List>
        </Section>
      )}

      <Section title="Reuniones">
        {c.meetings.length === 0 ? (
          <Empty
            title="Sin reuniones."
            hint="Aparecen las reuniones donde figura como participante."
          />
        ) : (
          <List>
            {c.meetings.map((m) => (
              <Row key={m.id} onClick={() => go({ name: 'meeting', id: m.id })}>
                <span className="min-w-0 flex-1 truncate text-list font-bold">{m.title}</span>
                <MeetingStatusPill status={m.status} />
                <span className="shrink-0 text-caption text-milk-soft">{dateTime(m.date)}</span>
              </Row>
            ))}
          </List>
        )}
      </Section>
    </Page>
  )
}

/** "Desde 2 oct 2026 · entró por webinar" / qué falta para poder suscribir. */
function consentLine(c: {
  status: string
  email: string | null
  consentAt: string | null
  source: string | null
  name: string | null
}): string {
  const origin =
    c.source && c.source !== 'manual'
      ? `entró por ${c.source}`
      : c.source === 'manual'
        ? 'suscrito a mano'
        : ''
  if (c.status === 'none') {
    return c.email
      ? `${contactLabel(c)} no recibe emails. Suscríbelo solo si te dio su permiso.`
      : 'Añade un email para poder suscribirlo.'
  }
  return [c.consentAt && `Consentimiento del ${shortDate(c.consentAt)}`, origin]
    .filter(Boolean)
    .join(' · ')
}

const SOFT = 'text-milk-soft'

function describe(e: ContactEvent): { icon: typeof Mail; text: string; tone: string } {
  const d = e.detail
  switch (e.type) {
    case 'lead':
      return {
        icon: Waypoints,
        text: `Entró por ${d.source ?? 'una fuente'}`,
        tone: 'text-apricot'
      }
    case 'subscribed':
      return { icon: Mail, text: 'Suscrito a los emails', tone: 'text-mint' }
    case 'status': {
      const bad = d.status === 'bounced' || d.status === 'complained'
      const label = {
        unsubscribed: 'Se dio de baja',
        bounced: 'Su email rebotó',
        complained: 'Marcó un email como spam'
      }[String(d.status)]
      return {
        icon: bad ? CircleAlert : MailX,
        text: label ?? `Estado: ${d.status}`,
        tone: bad ? 'text-coral' : SOFT
      }
    }
    case 'tag_added':
      return { icon: TagIcon, text: `Tag añadido: ${d.tag}`, tone: SOFT }
    case 'tag_removed':
      return { icon: TagIcon, text: `Tag quitado: ${d.tag}`, tone: SOFT }
    case 'promoted':
      return { icon: UserPlus, text: `Pasó a pipeline como ${d.company}`, tone: 'text-apricot' }
    case 'sync_error':
      return { icon: CircleAlert, text: `Error con Resend: ${d.error}`, tone: 'text-coral' }
  }
}
