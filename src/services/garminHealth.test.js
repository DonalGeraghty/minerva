import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { apiRequest } from './request.js'
import { healthLoaders, getActivityDetail, getPanelPreferences, savePanelPreferences } from './garminHealth.js'
import { queuedGarminRequest } from './garminQueue.js'
import { timeline } from './garminMetrics.js'

vi.mock('./request.js', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.resetAllMocks(); apiRequest.mockResolvedValue({}) })

describe('Garmin health requests', () => {
  it('uses bounded windows and independent refresh resources', async () => {
    for (const [resource, load] of Object.entries(healthLoaders)) {
      await load('2026-10-22')
      const query = new URLSearchParams(apiRequest.mock.lastCall[0].split('?')[1])
      expect(query.get('end')).toBe('2026-10-22')
      expect(query.get('start')).toBe(['body-battery', 'heart-rate', 'fitness-age'].includes(resource) ? '2026-10-22' : resource === 'weight' ? '2026-09-25' : '2026-10-16')
      await load('2026-10-22', { refresh: true })
      expect(JSON.parse(apiRequest.mock.lastCall[1].body).resources).toEqual([resource])
    }
    await getActivityDetail(123, true, { refresh: true })
    expect(apiRequest.mock.lastCall[0]).toBe('/api/garmin/activities/123/workouts')
    expect(apiRequest.mock.lastCall[1].method).toBe('POST')
    await getPanelPreferences()
    expect(apiRequest.mock.lastCall[0]).toBe('/api/garmin/preferences')
    await savePanelPreferences(['sleep'])
    expect(JSON.parse(apiRequest.mock.lastCall[1].body)).toEqual({ visible_panels: ['sleep'] })
  })

  it('limits concurrent requests to two and cancels queued requests without sending them', async () => {
    const complete = []
    apiRequest.mockImplementation(() => new Promise((resolve) => { complete.push(resolve) }))
    const first = queuedGarminRequest('/one'), second = queuedGarminRequest('/two')
    const controller = new AbortController()
    const third = queuedGarminRequest('/cancelled', { signal: controller.signal }).catch((error) => error)
    const fourth = queuedGarminRequest('/four')
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
    controller.abort()
    expect((await third).name).toBe('AbortError')
    complete[0]({})
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(3))
    expect(apiRequest.mock.lastCall[0]).toBe('/four')
    complete[1]({}); complete[2]({})
    await Promise.all([first, second, fourth])
  })

  it('reads descriptor indices and preserves missing timeline samples as gaps', () => {
    expect(timeline([[60, 1792627200000], [-1, 1792627260000], [0, 1792627320000]], [{ index: 1, key: 'timestamp' }, { index: 0, key: 'heartrate' }], 'heartrate').map((point) => point.value)).toEqual([60, null, 0])
    expect(timeline([[1792627200000, 60]], [], 'heartrate')).toEqual([])
  })
})
