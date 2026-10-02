import type { Meeting } from '@shared/consultora'

/**
 * Vista JSON de una reunión. La transcripción puede ser enorme: solo se incluye si se pide.
 * Sin ella, se informa su tamaño para que Claude sepa que existe.
 */
export function meetingView(
  m: Meeting,
  includeTranscript = false
): Omit<Meeting, 'transcriptMd'> & { transcriptMd?: string; transcriptChars: number } {
  const { transcriptMd, ...rest } = m
  return includeTranscript
    ? { ...rest, transcriptMd, transcriptChars: transcriptMd.length }
    : { ...rest, transcriptChars: transcriptMd.length }
}
