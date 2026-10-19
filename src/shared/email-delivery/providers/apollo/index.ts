import type { EmailProvider, ProviderDescriptor } from '../../ports/provider'
import { createApolloHttp } from './http'
import { APOLLO_INFO, apolloProvider, type ApolloOptions } from './provider'

export { APOLLO_INFO, apolloProvider } from './provider'
export { createApolloHttp, toSearch, type ApolloHttp, type Query } from './http'
export { apolloEvents, toDeliveryEvent } from './events'
export { toSteps, toWait } from './sequences'

export function createApolloProvider(
  credentials: { apiKey: string; scheduleId?: string },
  options: ApolloOptions = {}
): EmailProvider {
  return apolloProvider(createApolloHttp(credentials.apiKey), {
    ...options,
    scheduleId: credentials.scheduleId || options.scheduleId
  })
}

export function apolloDescriptor(options: ApolloOptions = {}): ProviderDescriptor {
  return {
    ...APOLLO_INFO,
    create: (credentials) =>
      createApolloProvider(
        { apiKey: credentials.apiKey, scheduleId: credentials.scheduleId || undefined },
        options
      )
  }
}
