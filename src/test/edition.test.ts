import { describe, expect, it } from 'vitest'
import { NEVER_SYNC, SOFT_DELETE_TABLES, SYNC_TABLES, isNeverSynced } from '../shared/edition'

describe('lo que nunca se sincroniza', () => {
  it('ninguna tabla prohibida está en la lista de sincronización', () => {
    for (const table of NEVER_SYNC.tables) {
      expect((SYNC_TABLES as readonly string[]).includes(table)).toBe(false)
    }
  })

  it('los secretos de las fuentes y las claves nunca viajan', () => {
    expect(isNeverSynced('lead_sources', 'secret')).toBe(true)
    expect(isNeverSynced('resend_outbox')).toBe(true)
    expect(isNeverSynced('clients', 'name')).toBe(false)
    expect(NEVER_SYNC.settings).toEqual(
      expect.arrayContaining(['openaiApiKey', 'resendApiKey', 'hubAdminToken'])
    )
    expect(NEVER_SYNC.files).toEqual(expect.arrayContaining(['settings.json', 'ui-state.json']))
  })

  it('las tablas con borrado suave se sincronizan', () => {
    for (const table of SOFT_DELETE_TABLES) expect(SYNC_TABLES).toContain(table)
  })
})
