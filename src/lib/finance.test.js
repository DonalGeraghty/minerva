import { describe, expect, it } from 'vitest'
import { eur, eurCents } from './finance.js'

describe('EUR display', () => {
  it('distinguishes unavailable values from real signed amounts and zero', () => {
    for (const value of [null, undefined, '', '  ', 'invalid', NaN, Infinity, false]) expect(eur(value)).toBe('Unavailable')
    for (const [value, expected] of [[0, '€0.00'], ['0.00', '€0.00'], ['-1234.50', '-€1,234.50'], [' 250.75 ', '€250.75']]) expect(eur(value)).toBe(expected)
  })
  it('formats chart cents without accepting fractional or unsafe integers', () => {
    expect(eurCents(-101)).toBe('-€1.01')
    expect(eurCents(0)).toBe('€0.00')
    expect(eurCents(123450)).toBe('€1,234.50')
    for (const value of [1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => eurCents(value)).toThrow()
  })
})
