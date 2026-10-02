export type AppErrorCode = 'invalid' | 'not_found' | 'day_full'

/** Error de negocio con un mensaje listo para mostrar (UI o Claude). Lo traduce error.middleware. */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string
  ) {
    super(message)
  }
}
