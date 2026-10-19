export class DeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class DeliveryUsageError extends DeliveryError {}
export class CapabilityNotSupported extends DeliveryUsageError {}
export class ProviderNotConfigured extends DeliveryUsageError {}
export class RoleNotAssigned extends DeliveryUsageError {}
export class RolePolicyViolation extends DeliveryUsageError {}
export class ProviderRuleViolation extends DeliveryUsageError {}

export type ErrorKind = 'fatal' | 'retryable' | 'rejected'

export class EmailProviderError extends DeliveryError {
  constructor(
    message: string,
    readonly provider: string,
    readonly code: string,
    readonly status: number | null,
    readonly kind: ErrorKind
  ) {
    super(message)
  }

  get fatal(): boolean {
    return this.kind === 'fatal'
  }

  get retryable(): boolean {
    return this.kind === 'retryable'
  }

  get notFound(): boolean {
    return this.code === 'not_found' || this.status === 404
  }
}

export const kindForStatus = (status: number | null): ErrorKind =>
  status === null || status === 429 || status >= 500 ? 'retryable' : 'rejected'
