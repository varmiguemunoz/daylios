import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { AuthUser, TokenVerifier } from '../../ports'

export class SupabaseTokenVerifier implements TokenVerifier {
  private readonly keys: JWTVerifyGetKey
  private readonly issuer: string

  constructor(supabaseUrl: string, keys?: JWTVerifyGetKey) {
    this.issuer = `${supabaseUrl}/auth/v1`
    this.keys = keys ?? createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`))
  }

  async verify(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.keys, {
      issuer: this.issuer,
      audience: 'authenticated'
    })
    if (typeof payload.sub !== 'string') throw new Error('Token sin usuario.')
    return {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null
    }
  }
}
