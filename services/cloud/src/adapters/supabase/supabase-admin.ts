import type { AccountAdmin } from '../../ports'

export class SupabaseAdmin implements AccountAdmin {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string
  ) {}

  private headers(): Record<string, string> {
    return { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` }
  }

  async deleteOrganizations(orgIds: string[]): Promise<void> {
    if (!orgIds.length) return
    const list = orgIds.map(encodeURIComponent).join(',')
    const res = await fetch(`${this.url}/rest/v1/organizations?id=in.(${list})`, {
      method: 'DELETE',
      headers: this.headers()
    })
    if (!res.ok) throw new Error(`No se pudieron borrar las organizaciones (${res.status}).`)
  }

  async deleteUser(userId: string): Promise<void> {
    const res = await fetch(`${this.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: this.headers()
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`No se pudo borrar la cuenta (${res.status}).`)
    }
  }
}
