import type { Meeting, MeetingBrief, OpenActionItem } from '@shared/consultora'

/** Reunión sin textos largos (para listas y fichas). */
export function brief(m: Meeting): MeetingBrief {
  return {
    id: m.id,
    date: m.date,
    title: m.title,
    clientId: m.clientId,
    projectId: m.projectId,
    prospectId: m.prospectId,
    status: m.status,
    participants: m.participants
  }
}

/** Action items sin hacer de varias reuniones, de la reunión más reciente a la más antigua. */
export function openActionItems(meetings: Meeting[]): OpenActionItem[] {
  return actionItems(meetings).filter((item) => !item.done)
}

/** Todos los action items, aplanados, con la reunión de origen. */
export function actionItems(meetings: Meeting[]): OpenActionItem[] {
  return [...meetings]
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((m) =>
      m.actionItems.map((item, index) => ({
        ...item,
        index,
        meetingId: m.id,
        meetingTitle: m.title,
        meetingDate: m.date,
        clientId: m.clientId
      }))
    )
}
