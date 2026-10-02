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

/**
 * Hoja antes de procesar una reunión (al detener una grabación o al subir un archivo):
 * título, participantes, asociación (sugerida por el título) e idioma hablado.
 */
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

  /** Sugerencia por título: solo rellena lo que aún está vacío. */
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
  const input = 'bg-transparent text-list outline-none'

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-night/75 p-6 [-webkit-app-region:no-drag]">
      <form
        className="toast-in w-full max-w-lg rounded-xl bg-surface p-6 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)]"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <h2 className="text-title font-extrabold">{heading}</h2>
        <p className="mt-1 text-caption text-milk-soft">{hint}</p>

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
          <span className="text-caption font-bold text-milk-soft">Idioma de la reunión</span>
          <div className="flex rounded-full bg-night p-1">
            {(['es', 'en'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                role="radio"
                aria-checked={language === lang}
                onClick={() => setLanguage(lang)}
                className={`h-8 rounded-full px-4 text-caption font-bold transition-colors ${
                  language === lang
                    ? 'bg-surface-raised text-milk'
                    : 'text-milk-soft hover:text-milk'
                }`}
              >
                {LANGUAGE_LABEL[lang]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-coral/12 px-4 py-3 text-caption text-coral">{error}</p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-full px-5 text-caption font-extrabold text-milk-soft hover:text-milk"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-10 rounded-full bg-apricot px-5 text-caption font-extrabold text-ink active:scale-95 disabled:bg-surface-raised disabled:text-milk-faint"
          >
            {busy ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Contactos del cliente/prospecto elegido como botones «+ Nombre» para añadir a participantes. */
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
          className="flex h-7 items-center gap-1 rounded-full px-3 text-caption font-bold text-milk-soft shadow-[inset_0_0_0_1.5px_var(--color-hairline)] hover:text-milk"
        >
          <Plus size={12} strokeWidth={3} />
          {c.name}
        </button>
      ))}
    </div>
  )
}
