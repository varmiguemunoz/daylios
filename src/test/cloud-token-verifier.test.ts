import { beforeAll, describe, expect, it } from 'vitest'
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { SupabaseTokenVerifier } from '../../services/cloud/src/adapters/supabase/supabase-token-verifier'

type VerifierKeys = NonNullable<ConstructorParameters<typeof SupabaseTokenVerifier>[1]>

const PROJECT = 'https://abc.supabase.co'
const OTHER = 'https://otro.supabase.co'

describe('guarda del microservicio: token de Supabase', () => {
  let keys: VerifierKeys
  let sign: (claims: { iss?: string; aud?: string; exp?: number; sub?: string }) => Promise<string>
  let foreign: (iss: string) => Promise<string>

  beforeAll(async () => {
    const mine = await generateKeyPair('ES256', { extractable: true })
    const theirs = await generateKeyPair('ES256', { extractable: true })
    const jwk = { ...(await exportJWK(mine.publicKey)), kid: 'k1', alg: 'ES256' }
    keys = createLocalJWKSet({ keys: [jwk] }) as unknown as VerifierKeys
    const now = Math.floor(Date.now() / 1000)
    sign = (c) =>
      new SignJWT({ email: 'ana@acme.com' })
        .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
        .setSubject(c.sub ?? 'u1')
        .setIssuer(c.iss ?? `${PROJECT}/auth/v1`)
        .setAudience(c.aud ?? 'authenticated')
        .setIssuedAt(now - 60)
        .setExpirationTime(c.exp ?? now + 600)
        .sign(mine.privateKey)
    foreign = (iss) =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
        .setSubject('u1')
        .setIssuer(iss)
        .setAudience('authenticated')
        .setExpirationTime(now + 600)
        .sign(theirs.privateKey)
  })

  it('acepta un token válido del proyecto y saca el usuario', async () => {
    const verifier = new SupabaseTokenVerifier(PROJECT, keys)
    expect(await verifier.verify(await sign({}))).toEqual({ userId: 'u1', email: 'ana@acme.com' })
  })

  it('rechaza un token caducado', async () => {
    const verifier = new SupabaseTokenVerifier(PROJECT, keys)
    const expired = await sign({ exp: Math.floor(Date.now() / 1000) - 10 })
    await expect(verifier.verify(expired)).rejects.toThrow()
  })

  it('rechaza un token de otro proyecto, aunque sea de la misma llave', async () => {
    const verifier = new SupabaseTokenVerifier(PROJECT, keys)
    await expect(verifier.verify(await sign({ iss: `${OTHER}/auth/v1` }))).rejects.toThrow()
  })

  it('rechaza un token firmado con otra llave', async () => {
    const verifier = new SupabaseTokenVerifier(PROJECT, keys)
    await expect(verifier.verify(await foreign(`${PROJECT}/auth/v1`))).rejects.toThrow()
  })

  it('rechaza una audiencia distinta', async () => {
    const verifier = new SupabaseTokenVerifier(PROJECT, keys)
    await expect(verifier.verify(await sign({ aud: 'anon' }))).rejects.toThrow()
  })
})
