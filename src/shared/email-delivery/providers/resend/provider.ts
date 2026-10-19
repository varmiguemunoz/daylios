import { ProviderRuleViolation } from '../../domain/errors'
import type { ProviderLimits } from '../../domain/capabilities'
import type { EmailProvider, ProviderInfo } from '../../ports/provider'
import type { ResendClient, WebhookVerifier } from './api'
import { resendWebhookEvents } from './events'
import { resendSequences } from './sequences'

export const RESEND_INFO: ProviderInfo = {
  id: 'resend',
  label: 'Resend',
  policy: { coldOutreach: false, sender: 'domain' },
  credentialKeys: ['apiKey'],
  capabilities: ['send', 'audience', 'sequences', 'broadcasts', 'events']
}

export const RESEND_LIMITS: ProviderLimits = { minIntervalMs: 110, dailyCap: null }

const needFrom = (from: string | undefined): string => {
  if (!from)
    throw new ProviderRuleViolation('Resend necesita un remitente. Configúralo en Ajustes, Email.')
  return from
}

export function resendProvider(
  client: ResendClient,
  options: { verify?: WebhookVerifier } = {}
): EmailProvider {
  return {
    ...RESEND_INFO,
    limits: RESEND_LIMITS,
    test: () => client.test(),

    sender: {
      async send({ from, to, replyTo, subject, html }) {
        return { id: await client.sendEmail({ from: needFrom(from), to, replyTo, subject, html }) }
      }
    },

    audience: {
      findContact: (email) => client.findContact(email),
      createContact: ({ groupIds, ...input }) =>
        client.createContact({ ...input, segmentIds: groupIds }),
      updateContact: (email, patch) => client.updateContact(email, patch),
      groupsOf: (email) => client.contactSegments(email),
      addToGroup: (email, id) => client.addToSegment(email, id),
      removeFromGroup: (email, id) => client.removeFromSegment(email, id),
      ensureGroup: (name) => client.ensureSegment(name),
      deleteGroup: (id) => client.deleteSegment(id)
    },

    sequences: resendSequences(client),

    broadcasts: {
      async send({ groupId, from, ...rest }) {
        return {
          id: await client.sendBroadcast({ segmentId: groupId, from: needFrom(from), ...rest })
        }
      }
    },

    events: options.verify ? resendWebhookEvents(options.verify) : undefined
  }
}
