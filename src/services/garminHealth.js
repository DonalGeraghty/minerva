import { apiRequest } from './request.js'
import { queuedGarminRequest } from './garminQueue.js'
import { daysBefore } from './garmin.js'

export const healthPanels = [
  ['stress', 'Stress'], ['hrv', 'HRV'], ['movement', 'Weekly movement'],
  ['weight', 'Weight'], ['hydration', 'Hydration'],
]
export const dashboardPanels = [['steps', 'Daily steps'], ['sleep', 'Sleep'], ...healthPanels]
export const defaultPanels = dashboardPanels.map(([id]) => id)

export const healthLoaders = Object.fromEntries(healthPanels.map(([resource]) => [resource, (date, { refresh = false, signal } = {}) => {
  const days = resource === 'weight' ? 27 : 6
  const parameters = { start: daysBefore(date, days), end: date }
  return refresh ? queuedGarminRequest('/api/garmin/refresh', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resources: [resource], ...parameters }),
  }) : queuedGarminRequest(`/api/garmin/data/${resource}?${new URLSearchParams(parameters)}`, { signal })
}]))

export function getActivityDetail(id, workouts, { refresh = false, signal } = {}) {
  return queuedGarminRequest(`/api/garmin/activities/${encodeURIComponent(id)}${workouts ? '/workouts' : ''}`, { method: refresh ? 'POST' : 'GET', signal })
}

export function getPanelPreferences(signal) {
  return apiRequest('/api/garmin/preferences', { signal })
}

export function savePanelPreferences(panels, signal) {
  return apiRequest('/api/garmin/preferences', { method: 'PUT', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visible_panels: panels }) })
}
