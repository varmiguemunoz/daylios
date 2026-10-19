import { ROLE_LABEL } from '@shared/organizations'
import type { InviteMail } from '../ports'

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c)

export function inviteEmail(mail: InviteMail): { subject: string; html: string; text: string } {
  const who = mail.inviterName ?? 'Alguien'
  const role = ROLE_LABEL[mail.role]
  return {
    subject: `${who} te invitó a ${mail.orgName} en DayliOS`,
    text: `${who} te invitó a ${mail.orgName} en DayliOS como ${role}.\n\nAcepta aquí: ${mail.link}\n\nLa invitación caduca en 7 días.`,
    html: `<p>${escapeHtml(who)} te invitó a <strong>${escapeHtml(mail.orgName)}</strong> en DayliOS como ${escapeHtml(role)}.</p>
<p><a href="${escapeHtml(mail.link)}">Aceptar la invitación</a></p>
<p style="color:#666">La invitación caduca en 7 días. Si no esperabas este email, ignóralo.</p>`
  }
}
