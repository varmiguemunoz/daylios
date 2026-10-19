import type { EmailProviderSummary, EmailRoleStatus } from '@shared/marketing'
import { RoleRow } from '../../molecules/RoleRow'
import { Section } from '../../ui'

type Role = EmailRoleStatus['role']

const ROLES: { role: Role; name: string; description: string }[] = [
  {
    role: 'transactional',
    name: 'Transaccional',
    description: 'Avisos para ti y correos uno a uno de las automatizaciones.'
  },
  {
    role: 'marketing',
    name: 'Marketing',
    description: 'Contactos suscritos, secuencias por evento y newsletter.'
  },
  {
    role: 'outreach',
    name: 'Outreach en frío',
    description: 'Prospectos que no se han suscrito. Solo aparecen proveedores que lo permiten.'
  }
]

const statusOf = (provider: EmailProviderSummary | undefined): { text: string; ok: boolean } => {
  if (!provider) return { text: 'Sin asignar', ok: false }
  return provider.configured
    ? { text: 'Configurado', ok: true }
    : { text: 'Falta la API key', ok: false }
}

export function EmailRoles({
  roles,
  providers,
  onChange
}: {
  roles: Partial<Record<Role, string>>
  providers: EmailProviderSummary[]
  onChange: (role: Role, provider: string | null) => void
}): React.JSX.Element {
  return (
    <Section title="Proveedores por uso">
      {ROLES.map(({ role, name, description }) => {
        const value = roles[role] ?? ''
        const status = statusOf(providers.find((p) => p.id === value))
        const options = providers
          .filter((p) => role !== 'outreach' || p.coldOutreach)
          .map((p) => ({ value: p.id, label: p.label }))
        return (
          <RoleRow
            key={role}
            name={name}
            description={description}
            value={value}
            options={options}
            status={status.text}
            ok={status.ok}
            onChange={(next) => onChange(role, next || null)}
          />
        )
      })}
    </Section>
  )
}
