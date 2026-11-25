import { moneyCents } from './finance.js'

function safe(value) {
  if (!Number.isSafeInteger(value)) throw new Error('The comparison is outside the supported chart range.')
  return value
}

function previousMonth(month) {
  const [year, number] = month.split('-').map(Number)
  return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`
}

export function cashflowChanges(flow, categoryFlow, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-IE', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit' }).formatToParts(now)
  const currentMonth = `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}`
  const monthly = new Map()
  for (const point of flow) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(point.month) || monthly.has(point.month)) throw new Error('Monthly comparison data needs review.')
    monthly.set(point.month, point)
  }
  const eligible = [...monthly.keys()].filter((month) => month < currentMonth).sort()
  const month = eligible.at(-1)
  const previous = month && previousMonth(month)
  if (!month || !monthly.has(previous)) return { empty: 'Choose a period with two consecutive completed months of recorded data. The current month is not compared.' }
  const groups = new Map()
  for (const point of categoryFlow) {
    if (groups.has(point.month)) throw new Error('The category comparison contains duplicate months.')
    groups.set(point.month, point.categories)
  }
  for (const key of [previous, month]) {
    const values = groups.get(key)
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('A category breakdown is unavailable. Refresh the imported data.')
    const total = Object.values(values).reduce((sum, value) => safe(sum + moneyCents(value)), 0)
    if (total !== moneyCents(monthly.get(key).net)) throw new Error('Category figures do not match the monthly net. Refresh to try again.')
  }
  const before = groups.get(previous), after = groups.get(month)
  const all = [...new Set([...Object.keys(before), ...Object.keys(after)])].map((name) => {
    const prior = Object.hasOwn(before, name) ? moneyCents(before[name]) : 0
    const current = Object.hasOwn(after, name) ? moneyCents(after[name]) : 0
    return { key: `category:${name}`, name: name || 'Uncategorised', category: name, before: prior, after: current, change: safe(current - prior) }
  }).filter((row) => row.change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.name.localeCompare(b.name))
  const rows = all.slice(0, 6)
  if (all.length > 6) {
    const rest = all.slice(6)
    rows.push({ key: 'other', name: 'Other categories', before: rest.reduce((sum, r) => safe(sum + r.before), 0), after: rest.reduce((sum, r) => safe(sum + r.after), 0), change: rest.reduce((sum, r) => safe(sum + r.change), 0) })
  }
  return { rows, previous, month, netChange: safe(moneyCents(monthly.get(month).net) - moneyCents(monthly.get(previous).net)), categoryCount: all.length }
}
