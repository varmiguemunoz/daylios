/** Puente hacia el proceso principal (SQLite vía IPC). Definido en src/preload. */
export const tasksApi = window.api.tasks
export const hideWindow = window.api.hideWindow
export const onWindowShown = window.api.onWindowShown
export const onTasksChanged = window.api.onTasksChanged
