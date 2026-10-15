import { keyLabel } from '@shared/keys'

const current = (): string => window.api?.platform ?? 'darwin'

export const isMac = (): boolean => current() === 'darwin'
export const isWindows = (): boolean => current() === 'win32'
export const kbd = (text: string): string => keyLabel(text, current())
export const fileManager = (): string => (isMac() ? 'Finder' : 'el Explorador')
export const trashName = (): string =>
  isMac() ? 'la Papelera de macOS' : 'la Papelera de reciclaje'
