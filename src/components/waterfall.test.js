import { describe, expect, it } from 'vitest'
import { categoryWaterfallSteps, waterfallSteps } from './waterfall.js'

describe('waterfall positions', () => {
  it('builds income, spending and refund steps in cents to the exact monthly net', () => {
    const items = [{ type: 'Refund', category: 'Food', amount_eur: '0.10' }, { type: 'Expense', category: 'Food', amount_eur: '-2.20' }, { type: 'Income', category: 'Salary', amount_eur: '1.10' }]
    const steps = categoryWaterfallSteps(items, '-1.00')
    expect(steps.map((step) => [step.start, step.end])).toEqual([[0, 110], [110, -110], [-110, -100], [0, -100]])
    expect(() => categoryWaterfallSteps(items, '0')).toThrow('do not match')
    expect(() => categoryWaterfallSteps([...items, items[0]], '-0.90')).toThrow('needs review')
    expect(() => categoryWaterfallSteps([{ ...items[0], amount_eur: null }], '0')).toThrow('unavailable')
    expect(categoryWaterfallSteps([], '0').at(-1).end).toBe(0)
  })
  it('connects monthly changes across zero and anchors the total to zero', () => {
    expect(waterfallSteps([{ month: '2026-03', net: '100.00' }, { month: '2026-01', net: '-120.00' }, { month: '2026-02', net: '50.00' }], '30.00')).toEqual([
      { key: '2026-01', change: -12000, start: 0, end: -12000 },
      { key: '2026-02', change: 5000, start: -12000, end: -7000 },
      { key: '2026-03', change: 10000, start: -7000, end: 3000 },
      { key: 'total', change: 3000, start: 0, end: 3000, total: true },
    ])
  })
  it('preserves cents exactly and rejects a mismatched server total', () => {
    const data = [{ month: '2026-01', net: '0.10' }, { month: '2026-02', net: '0.20' }]
    expect(waterfallSteps(data, '0.30').at(-1).end).toBe(30)
    expect(() => waterfallSteps(data, '0.31')).toThrow('do not match')
  })
  it('rejects unavailable values and duplicate months rather than plotting zero', () => {
    for (const net of [null, 'NaN', 'Infinity', '1.234']) expect(() => waterfallSteps([{ month: '2026-01', net }], '0')).toThrow()
    expect(() => waterfallSteps([{ month: '2026-01', net: '1' }, { month: '2026-01', net: '1' }], '2')).toThrow('needs review')
  })
})
