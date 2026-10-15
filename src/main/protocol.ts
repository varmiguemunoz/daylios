import { ACCOUNT_PROTOCOL } from '@shared/account'

export const protocolUrlIn = (argv: readonly string[]): string | null =>
  argv.find((arg) => arg.toLowerCase().startsWith(`${ACCOUNT_PROTOCOL}://`)) ?? null
