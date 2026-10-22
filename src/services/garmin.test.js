import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './request.js'
import { daysBefore, getGarminActivities, getGarminSleep } from './garmin.js'

vi.mock('./request.js', () => ({ apiRequest: vi.fn(async () => ({})) }))
beforeEach(() => vi.clearAllMocks())

describe('Garmin resource requests', () => {
  it('requests sleep for the selected calendar date and refreshes it independently', async () => {
    await getGarminSleep('2026-10-22')
    expect(apiRequest).toHaveBeenLastCalledWith('/api/garmin/data/sleep?date=2026-10-22', expect.any(Object))
    await getGarminSleep('2026-10-22', { refresh: true })
    expect(JSON.parse(apiRequest.mock.lastCall[1].body)).toEqual({ resources: ['sleep'], start: '2026-10-22', end: '2026-10-22' })
  })

  it('requests the latest five activities over 28 inclusive dates across year and DST boundaries', async () => {
    expect(daysBefore('2026-01-01', 27)).toBe('2025-12-05')
    expect(daysBefore('2026-10-26', 27)).toBe('2026-09-29')
    await getGarminActivities('2026-01-01')
    const query = new URLSearchParams(apiRequest.mock.lastCall[0].split('?')[1])
    expect(Object.fromEntries(query)).toEqual({ start: '2025-12-05', end: '2026-01-01', limit: '5' })
    await getGarminActivities('2026-01-01', { refresh: true })
    expect(JSON.parse(apiRequest.mock.lastCall[1].body)).toEqual({ resources: ['activities'], start: '2025-12-05', end: '2026-01-01', limit: 5 })
  })
})
