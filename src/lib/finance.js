const euroFormatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })

export const PERIODS = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_3', label: 'Last 3 months' },
  { id: 'last_6', label: 'Last 6 months' },
  { id: 'last_12', label: 'Last 12 months' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom months' },
]

export function eur(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return 'Unavailable'
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return 'Unavailable'
  const amount = Number(value)
  return Number.isFinite(amount) ? euroFormatter.format(amount) : 'Unavailable'
}

export function monthLabel(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month || '—'
  const [year, mon] = month.split('-').map(Number)
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString('en-IE', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}
