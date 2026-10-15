import { systemPreferences } from 'electron'

export const isMac = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'

export const accessibilityTrusted = (prompt = false): boolean =>
  isMac ? systemPreferences.isTrustedAccessibilityClient(prompt) : true

export async function askMicrophone(): Promise<void> {
  if (!isMac) return
  if (systemPreferences.getMediaAccessStatus('microphone') === 'not-determined') {
    await systemPreferences.askForMediaAccess('microphone')
  }
}

export const mediaStatus = (kind: 'microphone' | 'screen'): string =>
  isMac || isWindows ? systemPreferences.getMediaAccessStatus(kind) : 'granted'
