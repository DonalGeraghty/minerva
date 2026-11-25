import { apiRequest } from './request.js'

function periodParams(period, start, end) {
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

export function getCashflow(period, start, end, signal) {
  return apiRequest(`/api/finance/cashflow?${periodParams(period, start, end)}`, { signal })
}

export function getCashflowBreakdown(month, signal) {
  const params = periodParams('custom', month, month)
  params.set('by', 'breakdown')
  return apiRequest(`/api/finance/cashflow?${params}`, { signal })
}

export function getTransactions({ period, start, end, month, type, category, merchant, search, sort, order, limit, offset }, signal) {
  const params = periodParams(period, start, end)
  for (const [key, value] of Object.entries({ month, type, category, merchant, search, sort, order, limit, offset })) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value)
  }
  return apiRequest(`/api/finance/transactions?${params}`, { signal })
}

export function financeChat(message, history, signal) {
  return apiRequest('/api/finance/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
    signal,
  })
}
