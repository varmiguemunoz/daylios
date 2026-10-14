import type { CloudAdapters } from './index'

const noop = (): void => undefined

export const localAdapters = (): CloudAdapters => ({
  edition: 'local',
  sync: {
    syncNow: async () => ({ pushed: 0, pulled: 0 }),
    onRemoteChange: () => noop,
    stop: async () => undefined
  },
  files: {
    syncNow: async () => ({ uploaded: 0, downloaded: 0, conflicts: 0 }),
    stop: async () => undefined
  },
  identity: {
    current: async () => null,
    signIn: async () => {
      throw new Error('La edición Local no tiene cuenta.')
    },
    signOut: async () => undefined,
    accessToken: async () => null
  },
  presence: {
    announce: noop,
    onChange: () => noop,
    stop: async () => undefined
  },
  entitlements: {
    can: () => false,
    list: () => []
  }
})
