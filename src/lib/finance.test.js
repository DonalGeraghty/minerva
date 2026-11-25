import { describe, expect, it } from 'vitest'
import { eur } from './finance.js'

describe('EUR display', () => {
  it('distinguishes unavailable values from real signed amounts and zero', () => {
    for (const value of [null, undefined, '', '  ', 'invalid', NaN, Infinity, false]) expect(eur(value)).toBe('Unavailable')
    for (const [value, expected] of [[0, '€0.00'], ['0.00', '€0.00'], ['-1234.50', '-€1,234.50'], [' 250.75 ', '€250.75']]) expect(eur(value)).toBe(expected)
  })
})
