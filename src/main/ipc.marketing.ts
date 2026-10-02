import { ipcMain } from 'electron'
import type { Marketing } from './marketing'

/** IPC `marketing:<método>` para la ventana Consultora (contrato `MarketingApi`). */
export function registerMarketingIpc(m: Marketing, notify: () => void): void {
  const read = (channel: string, fn: (...args: never[]) => unknown): void => {
    ipcMain.handle(`marketing:${channel}`, (_e, ...args) => fn(...(args as never[])))
  }
  const write = (channel: string, fn: (...args: never[]) => Promise<unknown>): void => {
    ipcMain.handle(`marketing:${channel}`, async (_e, ...args) => {
      const result = await fn(...(args as never[]))
      notify()
      return result
    })
  }

  read('listTags', () => m.tags.list())
  write('renameTag', (slug: string, name: string) => m.tags.rename(slug, name))
  read('status', () => m.sync.status())
  write('syncNow', async () => {
    await m.sync.tick()
    return m.sync.status()
  })
  read('testResend', () => m.testResend())

  read('listSources', () => m.sources.list())
  write('createSource', (input) => m.sources.create(input ?? {}))
  write('updateSource', (slug: string, patch) => m.sources.update(slug, patch ?? {}))
  write('rotateSourceSecret', (slug: string) => m.sources.rotateSecret(slug))
  write('removeSource', (slug: string) => m.sources.remove(slug))
  read('listRules', () => m.rules.list())
  write('createRule', (input) => m.rules.create(input ?? {}))
  write('updateRule', (id: string, patch) => m.rules.update(id, patch ?? {}))
  write('removeRule', (id: string) => m.rules.remove(id))
  write('reorderRules', (ids) => m.rules.reorder(ids))
  read('listSequences', () => m.sequences.list())
  write('setSequenceStatus', (id: string, enabled: boolean) => m.sequences.setStatus(id, enabled))
  read('listNewsletters', () => m.newsletters.list())
  read('getNewsletter', (id: string) => m.newsletters.get(id))
  read('newsletterContext', () => m.newsletters.context())
  write('setNewsletterPaused', async (paused: boolean) => m.newsletters.setPaused(paused))
  read('testHub', async () => {
    const { ok, message } = await m.hubSync.health()
    if (ok) m.configChanged() // primera conexión: empujar la config ya
    return { ok, message }
  })
}
