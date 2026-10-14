import { AppError } from './app.error'

type MoveToTrash = (path: string) => Promise<void>

let impl: MoveToTrash = async () => {
  throw new AppError('invalid', 'La Papelera no está disponible.')
}

export function setTrash(fn: MoveToTrash): void {
  impl = fn
}

export const moveToTrash = (path: string): Promise<void> => impl(path)
