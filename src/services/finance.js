import { apiRequest } from './request.js'

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

export function periodParams(period, start, end) {
  const params = new URLSearchParams()
  if (period === 'custom') {
    if (start) params.set('start', start)
    if (end) params.set('end', end)
  } else {
    params.set('period', period)
  }
  return params
}

export function getSyncStatus(signal) {
  return apiRequest('/api/finance/sync/status', { signal })
}

export function syncNow(signal) {
  return apiRequest('/api/finance/sync', { method: 'POST', signal })
}

export function getSummary(period, start, end, signal) {
  return apiRequest(`/api/finance/summary?${periodParams(period, start, end)}`, { signal })
}

export function getCashflow(period, start, end, by = 'month', signal) {
  const params = periodParams(period, start, end)
  params.set('by', by)
  return apiRequest(`/api/finance/cashflow?${params}`, { signal })
}

export function getTransactions({ period, start, end, month, type, category, merchant, search, sort, order, limit, offset }, signal) {
  const params = periodParams(period, start, end)
  for (const [key, value] of Object.entries({ month, type, category, merchant, search, sort, order, limit, offset })) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value)
  }
  return apiRequest(`/api/finance/transactions?${params}`, { signal })
}

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

export function financeChat(message, history, signal) {
  return apiRequest('/api/finance/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
    signal,
  })
}
