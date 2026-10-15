import { describe, expect, it } from 'vitest'
import { fromApp } from '../main/vault-guard'

const req = (headers: Record<string, string> = {}, referrer?: string): Request =>
  ({ headers: new Headers(headers), referrer: referrer ?? '' }) as unknown as Request

describe('vault:// solo para la app', () => {
  it('acepta la app empaquetada, el propio esquema y el servidor de desarrollo', () => {
    expect(fromApp(req())).toBe(true)
    expect(fromApp(req({}, 'file:///Applications/DayliOS.app/index.html'))).toBe(true)
    expect(fromApp(req({}, 'vault://item/x'))).toBe(true)
    expect(fromApp(req({}, 'http://localhost:5173/'), 'http://localhost:5173')).toBe(true)
  })

  it('rechaza páginas web incrustadas', () => {
    expect(fromApp(req({}, 'https://evil.example/'))).toBe(false)
    expect(fromApp(req({ origin: 'https://evil.example' }))).toBe(false)
    expect(fromApp(req({}, 'http://localhost:5173/'))).toBe(false)
  })
})
