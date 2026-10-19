import { normalizeAddress } from '../../domain/names'
import type { DeliveryEvent } from '../../domain/events'
import type { PullEventSource } from '../../ports/events'
import type { ApolloHttp } from './http'

interface ApolloMessage {
  id: string
  to_email?: string | null
  status?: string | null
  replied?: boolean | null
  reply_class?: string | null
  completed_at?: string | null
  emailer_campaign_id?: string | null
}

const PAGES = 5

export function toDeliveryEvent(m: ApolloMessage): DeliveryEvent | null {
  if (!m.to_email || !m.completed_at) return null
  const email = normalizeAddress(m.to_email)
  const detail = {
    messageId: m.id,
    sequenceId: m.emailer_campaign_id ?? null,
    class: m.reply_class ?? null
  }
  const reply = (m.reply_class ?? '').toLowerCase()
  if (/unsub/.test(reply) || m.status === 'unsubscribed')
    return { id: `${m.id}:unsubscribed`, type: 'unsubscribed', email, at: m.completed_at, detail }
  if (m.replied || reply)
    return { id: `${m.id}:replied`, type: 'replied', email, at: m.completed_at, detail }
  if (m.status === 'bounced')
    return { id: `${m.id}:bounced`, type: 'bounced', email, at: m.completed_at, detail }
  return null
}

export function apolloEvents(http: ApolloHttp): PullEventSource {
  return {
    mode: 'pull',
    async poll(cursor) {
      const since = cursor ?? new Date(Date.now() - 7 * 86_400_000).toISOString()
      const events: DeliveryEvent[] = []
      let next = cursor
      for (let page = 1; page <= PAGES; page++) {
        const body = await http.request<{ emailer_messages?: ApolloMessage[] }>(
          'GET',
          '/emailer_messages/search',
          {
            query: {
              emailer_message_date_range_mode: 'completed_at',
              'emailer_message_date_range[min]': since.slice(0, 10),
              per_page: 100,
              page
            }
          }
        )
        const messages = body.emailer_messages ?? []
        for (const m of messages) {
          if (!m.completed_at || m.completed_at <= since) continue
          if (!next || m.completed_at > next) next = m.completed_at
          const event = toDeliveryEvent(m)
          if (event) events.push(event)
        }
        if (messages.length < 100) break
      }
      return { events, cursor: next }
    }
  }
}
