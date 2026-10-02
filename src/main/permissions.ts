import { app, shell, systemPreferences } from 'electron'

export type Privacy = 'screen' | 'microphone' | 'accessibility'

export interface PermissionStatus {
  /** 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown' */
  screen: string
  microphone: string
  /** Accesibilidad: necesaria para detectar «soltar» el atajo de voz. */
  accessibility: boolean
}

const PANES: Record<Privacy, string> = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
}

/**
 * Estado de los permisos de macOS. Si el micrófono aún no se ha pedido, muestra el diálogo de macOS.
 * La Grabación de pantalla no se puede pedir por API: la pide macOS en el primer intento,
 * y después de concederla hay que reiniciar la app.
 */
export async function checkPermissions(): Promise<PermissionStatus> {
  if (systemPreferences.getMediaAccessStatus('microphone') === 'not-determined') {
    await systemPreferences.askForMediaAccess('microphone')
  }
  return {
    screen: systemPreferences.getMediaAccessStatus('screen'),
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
    accessibility: systemPreferences.isTrustedAccessibilityClient(false)
  }
}

/** Abre la sección de Privacidad correspondiente en Ajustes del Sistema. */
export async function openPrivacy(kind: Privacy): Promise<void> {
  // Pedir Accesibilidad añade la app a la lista (con su interruptor) la primera vez.
  if (kind === 'accessibility') systemPreferences.isTrustedAccessibilityClient(true)
  await shell.openExternal(PANES[kind])
}

/**
 * Reinicia DayliOS (macOS exige reiniciar tras conceder Grabación de pantalla).
 * Instalada como servicio, basta con salir: launchd la vuelve a abrir en unos segundos.
 * En desarrollo no hay launchd, así que se relanza sola.
 */
export function restartApp(): void {
  if (!app.isPackaged) app.relaunch()
  app.exit(0)
}
