import { moneyCents as cents } from '../lib/finance.js'

export function waterfallSteps(data, total) {
  const seen = new Set()
  let running = 0
  const steps = [...data].sort((a, b) => a.month.localeCompare(b.month)).map((row) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || seen.has(row.month)) throw new Error('Monthly data needs review.')
    seen.add(row.month)
    const change = cents(row.net)
    const start = running
    running += change
    if (!Number.isSafeInteger(running)) throw new Error('The total is outside the supported chart range.')
    return { key: row.month, change, start, end: running }
  })
  const net = cents(total)
  if (net !== running) throw new Error('Monthly figures do not match the reported total. Refresh the page to try again.')
  return [...steps, { key: 'total', change: net, start: 0, end: net, total: true }]
}
