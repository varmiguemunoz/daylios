export type AppErrorCode = 'invalid' | 'not_found' | 'day_full' | 'conflict'

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string
  ) {
    super(message)
  }
}
