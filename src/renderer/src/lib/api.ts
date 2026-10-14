export const tasksApi = window.api.tasks
export const notesApi = window.api.notes
export const hideWindow = window.api.hideWindow
export const onWindowShown = window.api.onWindowShown
export const onDataChanged = window.api.onDataChanged

export function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '')
}
