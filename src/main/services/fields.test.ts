import { describe, expect, it } from 'vitest'
import { AppError } from './app.error'
import { oneOf, optionalAmount, optionalDay, optionalText, requiredText } from './fields'

describe('fields', () => {
  it('requiredText recorta y exige contenido', () => {
    expect(requiredText('  Hola ', 'El nombre')).toBe('Hola')
    expect(() => requiredText('   ', 'El nombre')).toThrow(AppError)
    expect(() => requiredText('x'.repeat(201), 'El nombre')).toThrow(/200/)
  })

  it('optionalText convierte vacío en null', () => {
    expect(optionalText('', 'X')).toBeNull()
    expect(optionalText(undefined, 'X')).toBeNull()
    expect(() => optionalText(3, 'X')).toThrow(AppError)
  })

  it('oneOf solo acepta valores permitidos', () => {
    expect(oneOf('a', ['a', 'b'], 'X')).toBe('a')
    expect(() => oneOf('c', ['a', 'b'], 'X')).toThrow(/a, b/)
  })

  it('optionalDay y optionalAmount validan formato', () => {
    expect(optionalDay('2026-10-02', 'F')).toBe('2026-10-02')
    expect(() => optionalDay('02/10/2026', 'F')).toThrow(AppError)
    expect(optionalAmount('12.5', 'V')).toBe(12.5)
    expect(() => optionalAmount(-1, 'V')).toThrow(AppError)
  })
})
