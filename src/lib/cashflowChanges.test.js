import { describe, expect, it } from 'vitest'
import { cashflowChanges } from './cashflowChanges.js'

const NOW = new Date('2026-08-15T12:00:00Z')

describe('Cash-flow movers', () => {
  it('reconciles signed category changes and excludes the current month', () => {
    const flow = [{ month: '2026-06', net: '100.00' }, { month: '2026-07', net: '-300.00' }, { month: '2026-08', net: '9999' }]
    const groups = [{ month: '2026-06', categories: { Income: '500', Food: '-100', Rent: '-300' } }, { month: '2026-07', categories: { Income: '500', Food: '-200', Rent: '-300', Travel: '-300' } }]
    const result = cashflowChanges(flow, groups, NOW)
    expect(result.month).toBe('2026-07')
    expect(result.previous).toBe('2026-06')
    expect(result.rows.map((r) => [r.name, r.change])).toEqual([['Travel', -30000], ['Food', -10000]])
    expect(result.rows.reduce((sum, r) => sum + r.change, 0)).toBe(result.netChange)
    expect(() => cashflowChanges(flow, [{ ...groups[0], categories: { Income: null } }, groups[1]], NOW)).toThrow('unavailable')
    expect(() => cashflowChanges(flow, [{ ...groups[0], categories: { Income: '99' } }, groups[1]], NOW)).toThrow('do not match')
  })

  it('does not compare across gaps or invent a missing category breakdown', () => {
    expect(cashflowChanges([{ month: '2026-05', net: '0' }, { month: '2026-07', net: '0' }], [], NOW).empty).toMatch('consecutive')
    expect(cashflowChanges([], [], NOW).empty).toBeTruthy()
    const flow = [{ month: '2026-06', net: '0' }, { month: '2026-07', net: '0' }]
    expect(() => cashflowChanges(flow, [], NOW)).toThrow('unavailable')
  })

  it('groups smaller movements while preserving the exact net change', () => {
    const before = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`Category ${i}`, '0']))
    const after = Object.fromEntries(Object.keys(before).map((name) => [name, '0.01']))
    const result = cashflowChanges([{ month: '2026-06', net: '0' }, { month: '2026-07', net: '0.09' }], [{ month: '2026-06', categories: before }, { month: '2026-07', categories: after }], NOW)
    expect(result.rows).toHaveLength(7)
    expect(result.rows.at(-1)).toMatchObject({ name: 'Other categories', change: 3 })
    expect(result.rows.reduce((sum, r) => sum + r.change, 0)).toBe(9)
  })
})
