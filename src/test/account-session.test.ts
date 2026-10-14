import { mkdtempSync, readFileSync, existsSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { SecureSessionStorage, type Cipher } from '../main/cloud/session-storage'
import { AuthCallback, DEEP_LINK } from '../main/cloud/callback'
import { cloudEnv } from '../main/cloud/env'
import { initialsOf } from '../shared/account'

const cipher = (available = true): Cipher => ({
  isEncryptionAvailable: () => available,
  encryptString: (text) =>
    Buffer.from(Buffer.from(text).toString('base64').split('').reverse().join('')),
  decryptString: (data) =>
    Buffer.from(data.toString().split('').reverse().join(''), 'base64').toString()
})

const file = (): string => join(mkdtempSync(join(tmpdir(), 'daylios-session-')), 'session.bin')

describe('sesión cifrada', () => {
  it('nunca guarda el token en texto plano y lo recupera al reabrir', () => {
    const path = file()
    const a = new SecureSessionStorage(path, cipher())
    a.setItem('daylios-auth', '{"access_token":"secreto"}')
    expect(readFileSync(path, 'utf8')).not.toContain('secreto')
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(new SecureSessionStorage(path, cipher()).getItem('daylios-auth')).toContain('secreto')
  })

  it('sin cifrado disponible solo vive en memoria', () => {
    const path = file()
    const s = new SecureSessionStorage(path, cipher(false))
    s.setItem('daylios-auth', 'x')
    expect(s.getItem('daylios-auth')).toBe('x')
    expect(existsSync(path)).toBe(false)
  })

  it('cerrar sesión borra el archivo', () => {
    const path = file()
    const s = new SecureSessionStorage(path, cipher())
    s.setItem('k', 'v')
    s.clear()
    expect(existsSync(path)).toBe(false)
  })
})

describe('vuelta del navegador', () => {
  it('acepta el código solo mientras hay un inicio de sesión y solo una vez', async () => {
    const cb = new AuthCallback(true)
    expect(cb.handleUrl(`${DEEP_LINK}?code=antes`)).toBe(true)
    const code = cb.wait(10_000)
    cb.handleUrl(`${DEEP_LINK}?code=abc`)
    expect(await code).toBe('abc')
    const again = cb.wait(10_000)
    cb.cancel()
    await expect(again).rejects.toThrow(/cancelado/)
  })

  it('un error del proveedor rechaza el intento con su mensaje', async () => {
    const cb = new AuthCallback(true)
    const code = cb.wait(10_000)
    cb.handleUrl(
      `${DEEP_LINK}?error=access_denied&error_description=Cancelado%20por%20la%20persona`
    )
    await expect(code).rejects.toThrow(/Cancelado por la persona/)
  })

  it('ignora enlaces que no son de acceso', () => {
    expect(new AuthCallback(true).handleUrl('daylios://otra/cosa')).toBe(false)
    expect(new AuthCallback(true).handleUrl('no es url')).toBe(false)
  })
})

describe('configuración de la nube', () => {
  const env = {
    MAIN_VITE_SUPABASE_URL: 'https://abc.supabase.co/',
    MAIN_VITE_SUPABASE_ANON_KEY: 'anon',
    MAIN_VITE_CLOUD_URL: 'https://cloud.daylios.app'
  }

  it('sin las tres variables, solo Local', () => {
    expect(cloudEnv({ ...env, MAIN_VITE_CLOUD_URL: '' } as ImportMetaEnv)).toBeNull()
  })

  it('exige https salvo el microservicio en este equipo', () => {
    expect(
      cloudEnv({ ...env, MAIN_VITE_SUPABASE_URL: 'http://abc.supabase.co' } as ImportMetaEnv)
    ).toBeNull()
    expect(
      cloudEnv({ ...env, MAIN_VITE_CLOUD_URL: 'http://127.0.0.1:8787' } as ImportMetaEnv)?.cloudUrl
    ).toBe('http://127.0.0.1:8787')
    expect(cloudEnv(env as ImportMetaEnv)?.supabaseUrl).toBe('https://abc.supabase.co')
  })

  it('iniciales para la franja', () => {
    expect(initialsOf('Miguel Ángel Muñoz', null)).toBe('MM')
    expect(initialsOf(null, 'ana@x.com')).toBe('AN')
  })
})
