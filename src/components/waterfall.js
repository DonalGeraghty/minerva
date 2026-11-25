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

export function categoryWaterfallSteps(items, total) {
  if (!Array.isArray(items)) throw new Error('The category breakdown is unavailable.')
  const seen = new Set()
  const order = { Income: 0, Expense: 1, Refund: 2 }
  const rows = items.map((item) => {
    if (!Object.hasOwn(order, item.type) || typeof item.category !== 'string' || !item.category.trim()) throw new Error('Category data needs review.')
    const key = JSON.stringify([item.type, item.category])
    if (seen.has(key)) throw new Error('Category data needs review.')
    seen.add(key)
    return { key, label: item.category, type: item.type, change: cents(item.amount_eur) }
  }).sort((a, b) => order[a.type] - order[b.type] || Math.abs(b.change) - Math.abs(a.change) || a.label.localeCompare(b.label))
  let running = 0
  const steps = rows.filter((row) => row.change !== 0).map((row) => {
    const start = running
    running += row.change
    if (!Number.isSafeInteger(running)) throw new Error('The total is outside the supported chart range.')
    return { ...row, start, end: running }
  })
  const net = cents(total)
  if (net !== running) throw new Error('Category figures do not match the selected month. Refresh the dashboard to try again.')
  return [...steps, { key: 'total', label: 'Net total', change: net, start: 0, end: net, total: true }]
}
