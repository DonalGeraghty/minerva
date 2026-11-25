// Exact cents for chart positions; the authoritative total comes from Janus.
function cents(value) {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!match) throw new Error('A monthly amount is unavailable.')
  const amount = (BigInt(match[2]) * 100n + BigInt((match[3] || '').padEnd(2, '0'))) * (match[1] ? -1n : 1n)
  const result = Number(amount)
  if (!Number.isSafeInteger(result)) throw new Error('A monthly amount is outside the supported chart range.')
  return result
}

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
