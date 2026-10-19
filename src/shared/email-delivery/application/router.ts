import {
  CAPABILITY_LABEL,
  ROLE_LABEL,
  type Capability,
  type DeliveryRole,
  type ProviderId,
  type RoleAssignment
} from '../domain/capabilities'
import {
  CapabilityNotSupported,
  ProviderNotConfigured,
  RoleNotAssigned,
  RolePolicyViolation
} from '../domain/errors'
import type { AudienceStore } from '../ports/audience'
import type { BroadcastSender } from '../ports/broadcasts'
import type { DeliveryEventSource } from '../ports/events'
import { portOf, type EmailProvider, type ProviderInfo } from '../ports/provider'
import type { EmailSender } from '../ports/sender'
import type { SequenceEngine } from '../ports/sequences'
import type { ProviderSource } from './registry'

export function policyProblem(role: DeliveryRole, info: ProviderInfo): string | null {
  if (role === 'outreach' && !info.policy.coldOutreach)
    return `${info.label} no permite correo en frío. Asigna outreach a un proveedor que sí lo permita.`
  return null
}

export function checkRoles(
  roles: RoleAssignment,
  info: (id: ProviderId) => ProviderInfo | null
): void {
  for (const [role, id] of Object.entries(roles) as [DeliveryRole, ProviderId | undefined][]) {
    if (!id) continue
    const provider = info(id)
    if (!provider) throw new ProviderNotConfigured(`El proveedor «${id}» no existe.`)
    const problem = policyProblem(role, provider)
    if (problem) throw new RolePolicyViolation(problem)
  }
}

export interface RoleStatus {
  role: DeliveryRole
  provider: ProviderId | null
  label: string | null
  configured: boolean
}

export class DeliveryRouter {
  constructor(
    private readonly providers: ProviderSource,
    private readonly roles: () => RoleAssignment
  ) {}

  assigned(role: DeliveryRole): ProviderId | null {
    return this.roles()[role] ?? null
  }

  describe(role: DeliveryRole): RoleStatus {
    const id = this.assigned(role)
    const info = id ? this.providers.info(id) : null
    return {
      role,
      provider: id,
      label: info?.label ?? null,
      configured: Boolean(id && info && this.providers.get(id))
    }
  }

  find(role: DeliveryRole): EmailProvider | null {
    const id = this.assigned(role)
    const info = id ? this.providers.info(id) : null
    if (!id || !info) return null
    const problem = policyProblem(role, info)
    if (problem) throw new RolePolicyViolation(problem)
    return this.providers.get(id)
  }

  use(role: DeliveryRole): EmailProvider {
    const id = this.assigned(role)
    if (!id)
      throw new RoleNotAssigned(
        `No hay proveedor de email para ${ROLE_LABEL[role]}. Elige uno en Ajustes, Email.`
      )
    const info = this.providers.info(id)
    if (!info) throw new ProviderNotConfigured(`El proveedor «${id}» no está disponible.`)
    const problem = policyProblem(role, info)
    if (problem) throw new RolePolicyViolation(problem)
    const provider = this.providers.get(id)
    if (!provider)
      throw new ProviderNotConfigured(
        `Falta la API key de ${info.label}. Configúrala en Ajustes, Email.`
      )
    return provider
  }

  sender(role: DeliveryRole): EmailSender {
    return this.port(role, 'send') as EmailSender
  }

  audience(role: DeliveryRole): AudienceStore {
    return this.port(role, 'audience') as AudienceStore
  }

  sequences(role: DeliveryRole): SequenceEngine {
    return this.port(role, 'sequences') as SequenceEngine
  }

  broadcasts(role: DeliveryRole): BroadcastSender {
    return this.port(role, 'broadcasts') as BroadcastSender
  }

  events(role: DeliveryRole): DeliveryEventSource {
    return this.port(role, 'events') as DeliveryEventSource
  }

  private port(role: DeliveryRole, capability: Capability): unknown {
    const provider = this.use(role)
    const port = provider[portOf(capability)]
    if (!port)
      throw new CapabilityNotSupported(
        `${provider.label} no soporta ${CAPABILITY_LABEL[capability]}.`
      )
    return port
  }
}
