import { AppError } from './app.error'

/** Puerto «Papelera de macOS». main lo conecta a `shell.trashItem`; los tests, a un fake. */
type MoveToTrash = (path: string) => Promise<void>

let impl: MoveToTrash = async () => {
  throw new AppError('invalid', 'La Papelera no está disponible.')
}

export function setTrash(fn: MoveToTrash): void {
  impl = fn
}

/** Mueve un archivo o carpeta a la Papelera (recuperable desde Finder). */
export const moveToTrash = (path: string): Promise<void> => impl(path)
