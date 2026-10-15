import { app, shell } from 'electron'
import { accessibilityTrusted, askMicrophone, isMac, isWindows, mediaStatus } from './platform'

export type Privacy = 'screen' | 'microphone' | 'accessibility'

export interface PermissionStatus {
  screen: string
  microphone: string

  accessibility: boolean
}

const MAC_PANES: Record<Privacy, string> = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
}

const WINDOWS_PANES: Partial<Record<Privacy, string>> = {
  microphone: 'ms-settings:privacy-microphone'
}

export async function checkPermissions(): Promise<PermissionStatus> {
  await askMicrophone()
  return {
    screen: mediaStatus('screen'),
    microphone: mediaStatus('microphone'),
    accessibility: accessibilityTrusted()
  }
}

export async function openPrivacy(kind: Privacy): Promise<void> {
  // Pedir Accesibilidad añade la app a la lista (con su interruptor) la primera vez.
  if (kind === 'accessibility') accessibilityTrusted(true)
  const pane = isMac ? MAC_PANES[kind] : isWindows ? WINDOWS_PANES[kind] : undefined
  if (pane) await shell.openExternal(pane)
}

export function restartApp(): void {
  if (!app.isPackaged) app.relaunch()
  app.exit(0)
}
