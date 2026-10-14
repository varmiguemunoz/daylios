import type { Meeting } from '@shared/consultora'

export function meetingView(
  m: Meeting,
  includeTranscript = false
): Omit<Meeting, 'transcriptMd'> & { transcriptMd?: string; transcriptChars: number } {
  const { transcriptMd, ...rest } = m
  return includeTranscript
    ? { ...rest, transcriptMd, transcriptChars: transcriptMd.length }
    : { ...rest, transcriptChars: transcriptMd.length }
}
