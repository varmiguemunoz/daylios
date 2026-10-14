import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Language, Refs } from '@shared/consultora'
import { errorMessage } from '../lib/api'
import { api, useLoad } from './lib'
import { Field, Select } from './ui'

export interface SheetInfo {
  title: string
  participants: string[]
  clientId: string | null
  projectId: string | null
  prospectId: string | null
  language: Language
}

const LANGUAGE_LABEL: Record<Language, string> = { es: 'Español', en: 'English' }

export function MeetingSheet({
  heading,
  hint,
  defaultTitle,
  submitLabel,
  onSubmit,
  onCancel
}: {
  heading: string
  hint: string
  defaultTitle: string
  submitLabel: string
  onSubmit: (info: SheetInfo) => Promise<void>
  onCancel?: () => void
}): React.JSX.Element {
  const [title, setTitle] = useState(defaultTitle)
  const [participants, setParticipants] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [prospectId, setProspectId] = useState('')
  const [language, setLanguage] = useState<Language>('es')
  const [refs, setRefs] = useState<Refs | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void api.refs().then(setRefs)
  }, [])

  const suggest = async (): Promise<void> => {
    const s = await api.suggestAssociation(title)
    if (!clientId && s.clientId) setClientId(s.clientId)
    if (!projectId && s.projectId) setProjectId(s.projectId)
    if (!prospectId && s.prospectId) setProspectId(s.prospectId)
  }

  const names = participants
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      await onSubmit({
        title,
        participants: names,
        clientId: clientId || null,
        projectId: projectId || null,
        prospectId: prospectId || null,
        language
      })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const projects = refs?.projects.filter((p) => !clientId || p.clientId === clientId) ?? []
  const input = 'bg-transparent text-[14px] text-ob-text outline-none placeholder:text-ob-faint'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6 [-webkit-app-region:no-drag]">
      <form
        className="toast-in w-full max-w-lg rounded-[8px] border border-ob-border bg-ob-alt p-5 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.8)]"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <h2 className="text-[16px] font-semibold">{heading}</h2>
        <p className="mt-1 text-[13px] text-ob-muted">{hint}</p>

        <div className="mt-5 flex flex-col gap-2">
          <Field label="Título">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void suggest()}
              className={input}
            />
          </Field>
          <Field label="Participantes (separados por comas)">
            <input
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="Ana (Acme), Miguel"
              className={input}
            />
          </Field>
          <ContactChips
            clientId={clientId || null}
            prospectId={prospectId || null}
            current={names}
            onAdd={(name) => setParticipants([...names, name].join(', '))}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Select
            label="Cliente"
            value={clientId}
            options={[
              { value: '', label: 'Sin cliente' },
              ...(refs?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))
            ]}
            onChange={(id) => {
              setClientId(id)
              setProjectId('')
            }}
          />
          <Select
            label="Proyecto"
            value={projectId}
            options={[
              { value: '', label: 'Sin proyecto' },
              ...projects.map((p) => ({ value: p.id, label: p.name }))
            ]}
            onChange={setProjectId}
          />
          <Select
            label="Prospecto"
            value={prospectId}
            options={[
              { value: '', label: 'Sin prospecto' },
              ...(refs?.prospects ?? []).map((p) => ({ value: p.id, label: p.company }))
            ]}
            onChange={setProspectId}
          />
        </div>

        <div role="radiogroup" aria-label="Idioma hablado" className="mt-4 flex items-center gap-3">
          <span className="text-[13px] text-ob-muted">Idioma de la reunión</span>
          <div className="flex gap-0.5 rounded-[6px] border border-ob-border bg-ob-bg p-0.5">
            {(['es', 'en'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                role="radio"
                aria-checked={language === lang}
                onClick={() => setLanguage(lang)}
                className={`h-6 rounded-[4px] px-3 text-[12px] font-medium transition-colors ${
                  language === lang
                    ? 'bg-ob-active text-ob-text'
                    : 'text-ob-muted hover:text-ob-text'
                }`}
              >
                {LANGUAGE_LABEL[lang]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-[4px] border border-ob-red/30 bg-ob-red/10 px-3 py-2 text-[13px] text-ob-red">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-[30px] rounded-[4px] bg-ob-active px-3 text-[13px] font-medium text-ob-text transition-colors hover:bg-[#3f3f3f]"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-[4px] bg-ob-accent px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#7a4fe0] disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

export function ContactChips({
  clientId,
  prospectId,
  current,
  onAdd
}: {
  clientId: string | null
  prospectId: string | null
  current: string[]
  onAdd: (name: string) => void
}): React.JSX.Element | null {
  const load = useCallback(
    () =>
      clientId || prospectId
        ? api
            .listContacts({
              client: clientId ?? undefined,
              prospect: clientId ? undefined : (prospectId ?? undefined),
              pageSize: 200
            })
            .then((page) => page.contacts)
        : Promise.resolve([]),
    [clientId, prospectId]
  )
  const { data } = useLoad(load)
  // Solo sugerimos personas con nombre (los participantes se escriben por nombre).
  const missing = (data ?? []).filter(
    (c): c is typeof c & { name: string } =>
      !!c.name && !current.some((p) => p.toLowerCase().includes(c.name!.toLowerCase()))
  )
  if (!missing.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {missing.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onAdd(c.name)}
          className="flex h-6 items-center gap-1 rounded-full border border-ob-border px-2 text-[12px] text-ob-muted transition-colors hover:border-ob-accent hover:text-ob-text"
        >
          <Plus size={12} />
          {c.name}
        </button>
      ))}
    </div>
  )
}
