import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Contact } from '@shared/consultora'
import { contactLabel } from '@shared/marketing'
import { api, attempt, type Go } from './lib'
import { Button, Empty, ErrorNote, List, Row, Section } from './ui'

/** Contactos de un cliente o prospecto, con alta rápida (nombre + Enter → abre el contacto para completarlo). */
export function ContactsSection({
  contacts,
  client,
  prospect,
  go
}: {
  contacts: Contact[]
  client?: string
  prospect?: string
  go: Go
}): React.JSX.Element {
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    if (!name?.trim()) return setName(null)
    let id = ''
    const failed = await attempt(async () => {
      id = (await api.createContact({ name, client, prospect })).id
    })
    setError(failed)
    if (!failed) go({ name: 'contact', id })
  }

  return (
    <Section
      title="Contactos"
      aside={
        <Button onClick={() => setName('')}>
          <Plus size={15} />
          Añadir
        </Button>
      }
    >
      {name !== null && (
        <form
          className="mb-3"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setName(null)}
            placeholder="Nombre y Enter"
            aria-label="Nombre del contacto"
            className="h-8 w-full px-2.5 text-[14px] rounded-[4px] border border-ob-border bg-ob-bg text-ob-text outline-none placeholder:text-ob-faint focus:border-ob-accent"
          />
        </form>
      )}
      <ErrorNote message={error} />
      {contacts.length === 0 ? (
        <Empty title="Sin contactos." hint="Añade a las personas con las que hablas." />
      ) : (
        <List>
          {contacts.map((c) => (
            <Row key={c.id} onClick={() => go({ name: 'contact', id: c.id })}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-list font-medium">{contactLabel(c)}</span>
                {c.role && (
                  <span className="block truncate text-caption text-ob-muted">{c.role}</span>
                )}
              </span>
              <span className="shrink-0 truncate text-caption text-ob-muted">
                {c.email ?? c.phone ?? ''}
              </span>
            </Row>
          ))}
        </List>
      )}
    </Section>
  )
}
