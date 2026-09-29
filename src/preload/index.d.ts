import type { TasksApi } from '../shared/tasks'

declare global {
  interface Window {
    api: {
      tasks: TasksApi
      hideWindow: () => void
      /** La ventana del menubar se acaba de mostrar. */
      onWindowShown: (cb: () => void) => () => void
      /** Claude (u otro cliente de la API local) cambió tareas. */
      onTasksChanged: (cb: () => void) => () => void
    }
  }
}
