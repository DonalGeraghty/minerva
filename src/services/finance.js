import { apiRequest, ApiError } from './request.js'
import { authFetch } from '../config/api.js'

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

export function getBudgetContext(signal) {
  return apiRequest('/api/finance/budget/context', { signal })
}

export async function createBudgetPlan(signal, onProgress = () => {}) {
  const response = await authFetch('/api/finance/budget/plan', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: '{}', signal,
  })
  const fail = (data, status) => { throw new ApiError(data.message || data.error || 'The assessment could not finish.', status, data.error, data) }
  // Older Janus deployments still return JSON; keep that path compatible.
  if (!response.ok || !response.headers.get('Content-Type')?.includes('application/x-ndjson')) {
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.status === 'error') fail(data, response.status)
    if (!data.plan) fail({ error: 'budget_stream_incomplete', message: 'No plan arrived. Your previous plan is retained.' }, 502)
    return data
  }
  const reader = response.body?.getReader()
  if (!reader) fail({ error: 'budget_stream_incomplete', message: 'The assessment connection ended. Your previous plan is retained.' }, 502)
  const decoder = new TextDecoder()
  let pending = '', bytes = 0, result = null
  const receive = (line) => {
    if (!line.trim()) return
    const event = JSON.parse(line)
    if (event.event === 'progress') onProgress(event.stage)
    if (event.event === 'error') fail(event.data || {}, event.http_status || 502)
    if (event.event === 'result' && event.data?.status === 'success' && event.data.plan) result = event.data
  }
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) { pending += decoder.decode(); break }
      bytes += value.byteLength
      if (bytes > 1_000_000) fail({ error: 'budget_stream_invalid', message: 'The assessment response was too large. Your previous plan is retained.' }, 502)
      pending += decoder.decode(value, { stream: true })
      let newline
      while ((newline = pending.indexOf('\n')) >= 0) {
        receive(pending.slice(0, newline))
        pending = pending.slice(newline + 1)
      }
    }
    if (pending.trim()) receive(pending)
    if (!result) fail({ error: 'budget_stream_incomplete', message: 'The assessment connection ended before a plan arrived. Your previous plan is retained.' }, 502)
    return result
  } catch (error) {
    if (error instanceof SyntaxError) fail({ error: 'budget_stream_invalid', message: 'The assessment response was interrupted. Your previous plan is retained.' }, 502)
    throw error
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
