import { app, shell, systemPreferences } from 'electron'

export type Privacy = 'screen' | 'microphone' | 'accessibility'

export interface PermissionStatus {
  screen: string
  microphone: string

  accessibility: boolean
}

const PANES: Record<Privacy, string> = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
}

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

export async function openPrivacy(kind: Privacy): Promise<void> {
  // Pedir Accesibilidad añade la app a la lista (con su interruptor) la primera vez.
  if (kind === 'accessibility') systemPreferences.isTrustedAccessibilityClient(true)
  await shell.openExternal(PANES[kind])
}

export function restartApp(): void {
  if (!app.isPackaged) app.relaunch()
  app.exit(0)
}
