import { IsNull, Not, type DataSource } from 'typeorm'
import { ContactModel } from '../models/contact.model'
import { TagModel } from '../models/marketing.model'
import { transactionGuard } from '../guards/transaction.guard'
import { enqueueContactSync } from './outbox'

export async function resetAudience(db: DataSource): Promise<number> {
  return transactionGuard(db, async (m) => {
    await m.getRepository(TagModel).update({ segmentId: Not(IsNull()) }, { segmentId: null })
    const contacts = await m
      .getRepository(ContactModel)
      .find({ where: { status: Not('none'), email: Not(IsNull()) }, select: { id: true } })
    await m
      .getRepository(ContactModel)
      .update({ status: Not('none') }, { syncedAt: null, syncError: null })
    for (const c of contacts) await enqueueContactSync(m, c.id)
    return contacts.length
  })
}
