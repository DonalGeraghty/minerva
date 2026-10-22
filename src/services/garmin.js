import { apiRequest } from './request.js'

export function getGarminConnection(signal) {
  return apiRequest('/api/garmin/connection', { signal })
}

export function saveGarminConnection(apiKey, signal) {
  return apiRequest('/api/garmin/connection', {
    method: 'PUT', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })
}

export function disconnectGarmin(signal) {
  return apiRequest('/api/garmin/connection', { method: 'DELETE', signal })
}

export function getGarminSteps(date, { refresh = false, signal } = {}) {
  if (refresh) return apiRequest('/api/garmin/refresh', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resources: ['steps'], start: date, end: date }),
  })
  return apiRequest(`/api/garmin/data/steps?${new URLSearchParams({ start: date, end: date })}`, { signal })
}

export function getGarminSleep(date, { refresh = false, signal } = {}) {
  const parameters = { start: daysBefore(date, 6), end: date }
  if (refresh) return apiRequest('/api/garmin/refresh', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resources: ['sleep'], ...parameters }),
  })
  return apiRequest(`/api/garmin/data/sleep?${new URLSearchParams(parameters)}`, { signal })
}

export function daysBefore(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - days)
  return value.toISOString().slice(0, 10)
}

export function getGarminActivities(date, { refresh = false, signal } = {}) {
  const parameters = { start: daysBefore(date, 27), end: date, limit: 5 }
  if (refresh) return apiRequest('/api/garmin/refresh', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resources: ['activities'], ...parameters }),
  })
  return apiRequest(`/api/garmin/data/activities?${new URLSearchParams(parameters)}`, { signal })
}

export function localDate(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function freshnessText(seconds, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - seconds * 1000) / 60000))
  if (minutes < 1) return 'Updated just now'
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `Updated ${days} day${days === 1 ? '' : 's'} ago`
}
