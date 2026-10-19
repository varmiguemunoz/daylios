import type { ProviderLimits } from '../../domain/capabilities'
import type { EmailProvider, ProviderInfo } from '../../ports/provider'
import { apolloEvents } from './events'
import type { ApolloHttp } from './http'
import { apolloSequences, type ApolloSequenceOptions } from './sequences'

export const APOLLO_INFO: ProviderInfo = {
  id: 'apollo',
  label: 'Apollo',
  policy: { coldOutreach: true, sender: 'mailbox' },
  credentialKeys: ['apiKey'],
  capabilities: ['sequences', 'events']
}

export interface ApolloOptions extends ApolloSequenceOptions {
  dailyCap?: number | null
}

export function apolloProvider(http: ApolloHttp, options: ApolloOptions = {}): EmailProvider {
  const limits: ProviderLimits = { minIntervalMs: 200, dailyCap: options.dailyCap ?? null }
  return {
    ...APOLLO_INFO,
    limits,
    async test() {
      await http.request('GET', '/email_accounts')
    },
    sequences: apolloSequences(http, options),
    events: apolloEvents(http)
  }
}
