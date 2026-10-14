import { CHANGE_EVENT, realtimeChannel } from '@shared/sync-protocol'
import type { ChangeNotifier } from '../../ports'

export class RealtimeNotifier implements ChangeNotifier {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string
  ) {}

  async changes(orgId: string, cursor: number): Promise<void> {
    await fetch(`${this.url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { topic: realtimeChannel(orgId), event: CHANGE_EVENT, payload: { cursor }, private: true }
        ]
      }),
      signal: AbortSignal.timeout(5_000)
    })
  }
}
