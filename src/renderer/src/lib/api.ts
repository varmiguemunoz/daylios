/** Puente hacia el proceso principal (SQLite vía IPC). Definido en src/preload. */
export const tasksApi = window.api.tasks
export const notesApi = window.api.notes
export const hideWindow = window.api.hideWindow
export const onWindowShown = window.api.onWindowShown
export const onDataChanged = window.api.onDataChanged

/** Mensaje legible de un error que viene de main (quita el prefijo técnico de Electron). */
export function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '')
}
