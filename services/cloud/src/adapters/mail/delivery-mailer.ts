import { EmailProviderError, type EmailSender } from '@shared/email-delivery'
import { inviteEmail } from '../../application/invite-mail'
import type { InviteMail, Mailer } from '../../ports'

export class DeliveryMailer implements Mailer {
  constructor(
    private readonly sender: EmailSender,
    private readonly from: string
  ) {}

  async sendInvite(mail: InviteMail): Promise<boolean> {
    const { subject, html, text } = inviteEmail(mail)
    try {
      await this.sender.send({ from: this.from, to: mail.to, subject, html, text })
      return true
    } catch (error) {
      if (error instanceof EmailProviderError && error.code === 'http_error') return false
      throw error
    }
  }
}

export class NoMailer implements Mailer {
  async sendInvite(): Promise<boolean> {
    return false
  }
}
