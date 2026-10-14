export type UseCaseErrorKind = 'invalid' | 'conflict' | 'forbidden' | 'not-found'

export class UseCaseError extends Error {
  constructor(
    message: string,
    readonly kind: UseCaseErrorKind,
    readonly detail?: unknown
  ) {
    super(message)
  }
}

export const invalid = <T>(fn: () => T): T => {
  try {
    return fn()
  } catch (e) {
    throw new UseCaseError((e as Error).message, 'invalid')
  }
}
