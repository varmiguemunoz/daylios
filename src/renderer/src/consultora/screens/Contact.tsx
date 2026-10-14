import { useCallback, useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  AtSign,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  FolderKanban,
  Phone,
  SquareKanban,
  CircleAlert,
  ExternalLink,
  BriefcaseBusiness as Linkedin,
  Mail,
  MailX,
  Tag as TagIcon,
  UserPlus,
  Waypoints
} from 'lucide-react'
import type { ContactDetail, ContactInput } from '@shared/consultora'
import { STATUS_LABELS, contactLabel, type ContactEvent } from '@shared/marketing'
import { api, attempt, dateTime, shortDate, useLoad, type Go } from '../lib'
import {
  Button,
  ConfirmButton,
  EditableText,
  ErrorNote,
  IconButton,
  List,
  MarkdownField,
  MeetingStatusPill,
  Page,
  Row,
  Section
} from '../ui'
import { ContactStatusPill, TagEditor } from '../marketing-ui'
import { InlineField } from '../molecules/InlineField'
import { RefPicker } from '../molecules/RefPicker'
import { Properties, PropertyRow } from '../molecules/Properties'
import { useScreenTitle } from '../chrome'
import { ConvertToProspectModal } from '../organisms/ConvertToProspectModal'

/**
 * Ficha de contacto como una nota de Obsidian (impeccable · Operate): propiedades con datos,
 * relaciones y tags; después notas, email marketing, formulario y actividad. Una sola acción
 * primaria: convertir en prospecto (o verlo).
 */
export function Contact({
  id,
  go,
  back
}: {
  id: string
  go: Go
  back: () => void
}): React.JSX.Element {
  const load = useCallback(() => api.getContact(id), [id])
  const { data: c, error: loadError } = useLoad(load)
  useScreenTitle(c ? contactLabel(c) : null)
  const refsLoad = useCallback(() => api.refs(), [])
  const { data: refs } = useLoad(refsLoad)
  const tagsLoad = useCallback(() => window.api.marketing.listTags(), [])
  const { data: allTags } = useLoad(tagsLoad)

  const [error, setError] = useState<string | null>(null)
  const [confirmSubscribe, setConfirmSubscribe] = useState(false)
  const [converting, setConverting] = useState(false)

  const run = async (fn: () => Promise<unknown>): Promise<void> => setError(await attempt(fn))
  const save = (patch: ContactInput): Promise<void> => run(() => api.updateContact(id, patch))

  if (loadError?.includes('No existe ese contacto')) {
    return (
      <Page variant="document" title="Contacto no disponible">
        <p className="mt-4 text-caption text-ob-muted">Este contacto ya no existe.</p>
      </Page>
    )
  }
  if (!c)
    return (
      <Page variant="document" title="…">
        <ErrorNote message={loadError} />
      </Page>
    )

  const remove = async (): Promise<void> => {
    const failed = await attempt(() => api.removeContact(id))
    if (failed) setError(failed)
    else back()
  }

  const subscribe = async (): Promise<void> => {
    if (!confirmSubscribe) return setConfirmSubscribe(true)
    setConfirmSubscribe(false)
    await run(() => api.subscribeContact(id))
  }

  const clientName = c.clientId
    ? (refs?.clients.find((x) => x.id === c.clientId)?.name ?? c.organization ?? '')
    : ''
  const projects = (refs?.projects ?? []).filter((p) => p.clientId === c.clientId)
  const fields = Object.entries(c.fields)
  const canSubscribe = c.status === 'none' || c.status === 'unsubscribed'
  const defaultCompany =
    clientName || (typeof c.fields.company === 'string' ? c.fields.company : '') || contactLabel(c)
  const role = [c.role, c.organization].filter(Boolean).join(' · ')

  return (
    <Page
      variant="document"
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
          {role && <span>{role}</span>}
          <ContactStatusPill status={c.status} />
        </>
      }
      actions={
        <>
          <IconButton
            label={c.email ? `Escribir a ${c.email}` : 'Sin email'}
            disabled={!c.email}
            onClick={() => c.email && window.open(`mailto:${c.email}`)}
          >
            <Mail size={16} />
          </IconButton>
          <IconButton
            label={c.linkedin ? 'Abrir LinkedIn' : 'Sin LinkedIn'}
            disabled={!c.linkedin}
            onClick={() =>
              c.linkedin &&
              window.open(c.linkedin.startsWith('http') ? c.linkedin : `https://${c.linkedin}`)
            }
          >
            <Linkedin size={16} />
          </IconButton>
          {c.prospect ? (
            <Button onClick={() => go({ name: 'prospect', id: c.prospect!.id })}>
              <ExternalLink size={15} />
              Ver en pipeline
            </Button>
          ) : (
            <Button kind="primary" onClick={() => setConverting(true)}>
              <ArrowRightLeft size={15} />
              Convertir en prospecto
            </Button>
          )}
          <ConfirmButton label="Borrar contacto" onConfirm={() => void remove()} />
        </>
      }
    >
      {/* Se monta al abrir: el nombre propuesto sale de los datos ya cargados. */}
      {converting && (
        <ConvertToProspectModal
          open
          contactId={c.id}
          defaultCompany={defaultCompany}
          onClose={() => setConverting(false)}
          onDone={(prospectId) => {
            setConverting(false)
            go({ name: 'prospect', id: prospectId })
          }}
        />
      )}
      <ErrorNote message={error} />

      <Properties id="contact">
        <InlineField
          icon={BadgeCheck}
          label="Rol"
          value={c.role}
          placeholder="CTO, dueño, compras…"
          onSave={(role) => void save({ role })}
        />
        <InlineField
          icon={AtSign}
          label="Email"
          type="email"
          value={c.email}
          placeholder="nombre@empresa.com"
          onSave={(email) => void save({ email })}
        />
        <InlineField
          icon={Phone}
          label="Teléfono"
          type="tel"
          value={c.phone}
          placeholder="+1 …"
          onSave={(phone) => void save({ phone })}
        />
        <InlineField
          icon={Linkedin}
          label="LinkedIn"
          type="url"
          value={c.linkedin}
          placeholder="linkedin.com/in/…"
          onSave={(linkedin) => void save({ linkedin })}
        />
        <RefPicker
          icon={Briefcase}
          label="Cliente"
          value={c.clientId ? { id: c.clientId, label: clientName } : null}
          options={(refs?.clients ?? []).map((x) => ({
            id: x.id,
            label: x.name,
            hint: x.status === 'historico' ? 'Histórico' : undefined
          }))}
          onChange={(client) => void save({ client })}
          onOpen={(clientId) => go({ name: 'client', id: clientId })}
        />
        <RefPicker
          icon={FolderKanban}
          label="Proyecto"
          value={c.project ? { id: c.project.id, label: c.project.name } : null}
          options={projects.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(project) => void save({ project })}
          onOpen={(projectId) => go({ name: 'project', id: projectId })}
          disabled={!c.clientId}
          disabledHint="Asigna antes un cliente"
        />
        <RefPicker
          icon={SquareKanban}
          label="Prospecto"
          value={
            c.prospect
              ? {
                  id: c.prospect.id,
                  label: c.prospect.company,
                  hint: `${c.prospect.pipeline} · ${c.prospect.stage}`
                }
              : null
          }
          options={(refs?.prospects ?? []).map((p) => ({ id: p.id, label: p.company }))}
          onChange={(prospect) => void save({ prospect })}
          onOpen={(prospectId) => go({ name: 'prospect', id: prospectId })}
        />
        <PropertyRow icon={TagIcon} label="Tags">
          <TagEditor
            tags={c.tags}
            suggestions={allTags ?? []}
            onAdd={(tag) => void run(() => api.tagContact(id, { add: [tag] }))}
            onRemove={(slug) => void run(() => api.tagContact(id, { remove: [slug] }))}
          />
        </PropertyRow>
      </Properties>

      <Section title="Notas">
        <MarkdownField
          value={c.notesMd}
          placeholder="Cómo prefiere comunicarse, qué le importa, historia con nosotros…"
          onSave={(notesMd) => void save({ notesMd })}
        />
      </Section>

      <Section title="Email marketing">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] text-ob-text">{STATUS_LABELS[c.status]}</p>
            <p className="mt-0.5 text-[13px] text-ob-muted">{consentLine(c)}</p>
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
              className="flex h-[30px] items-center gap-1.5 rounded-[4px] bg-ob-active px-3 text-[13px] font-medium text-ob-text transition-colors hover:bg-[#3f3f3f] disabled:opacity-40"
            >
              <Mail size={15} className="text-ob-link" />
              {confirmSubscribe ? '¿Te dio su permiso? Suscribir' : 'Suscribir'}
            </button>
          )}
        </div>
        {c.syncError && (
          <p role="alert" className="mt-2 flex items-start gap-2 text-[13px] text-ob-red">
            <CircleAlert size={15} className="mt-px shrink-0" aria-hidden />
            No se pudo sincronizar con Resend: {c.syncError}. Se reintenta solo.
          </p>
        )}
      </Section>

      {fields.length > 0 && (
        <Section title="Formulario">
          <dl className="flex flex-col">
            {fields.map(([key, value]) => (
              <PropertyRow key={key} label={key}>
                <span className="block px-1.5 text-[14px] break-words text-ob-text">
                  {value === null ? '—' : String(value)}
                </span>
              </PropertyRow>
            ))}
          </dl>
        </Section>
      )}

      <Timeline contact={c} go={go} />
    </Page>
  )
}

/** Actividad: eventos del contacto y reuniones donde aparece, en una sola línea de tiempo. */
function Timeline({ contact, go }: { contact: ContactDetail; go: Go }): React.JSX.Element | null {
  const items = useMemo(
    () =>
      [
        ...contact.events.map((e) => ({ kind: 'event' as const, at: e.createdAt, event: e })),
        ...contact.meetings.map((m) => ({ kind: 'meeting' as const, at: m.date, meeting: m }))
      ].sort((a, b) => b.at.localeCompare(a.at)),
    [contact]
  )
  if (!items.length) return null
  return (
    <Section title="Actividad">
      <List>
        {items.map((item) => {
          if (item.kind === 'meeting') {
            const m = item.meeting
            return (
              <Row key={`m-${m.id}`} onClick={() => go({ name: 'meeting', id: m.id })}>
                <CalendarClock size={15} className="shrink-0 text-ob-link" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-list font-medium">{m.title}</span>
                <MeetingStatusPill status={m.status} />
                <span className="shrink-0 text-caption text-ob-muted tabular-nums">
                  {dateTime(m.date)}
                </span>
              </Row>
            )
          }
          const { icon: Icon, text: line, tone } = describe(item.event)
          return (
            <Row key={item.event.id}>
              <Icon size={15} className={`shrink-0 ${tone}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-list">{line}</span>
              <span className="shrink-0 text-caption text-ob-muted tabular-nums">
                {dateTime(item.at)}
              </span>
            </Row>
          )
        })}
      </List>
    </Section>
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

const SOFT = 'text-ob-muted'

function describe(e: ContactEvent): { icon: typeof Mail; text: string; tone: string } {
  const d = e.detail
  switch (e.type) {
    case 'lead':
      return {
        icon: Waypoints,
        text: `Entró por ${d.source ?? 'una fuente'}`,
        tone: 'text-ob-link'
      }
    case 'subscribed':
      return { icon: Mail, text: 'Suscrito a los emails', tone: 'text-ob-green' }
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
        tone: bad ? 'text-ob-red' : SOFT
      }
    }
    case 'tag_added':
      return { icon: TagIcon, text: `Tag añadido: ${d.tag}`, tone: SOFT }
    case 'tag_removed':
      return { icon: TagIcon, text: `Tag quitado: ${d.tag}`, tone: SOFT }
    case 'promoted':
      return { icon: UserPlus, text: `Pasó a pipeline como ${d.company}`, tone: 'text-ob-link' }
    case 'sync_error':
      return { icon: CircleAlert, text: `Error con Resend: ${d.error}`, tone: 'text-ob-red' }
  }
}
