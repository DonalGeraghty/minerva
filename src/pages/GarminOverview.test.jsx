import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GarminPage from './GarminPage.jsx'
import { getGarminActivities, getGarminSleep, getGarminSteps, localDate } from '../services/garmin.js'
import { ApiError } from '../services/request.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'one' }, logout: vi.fn() } }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('../services/garmin.js', async (original) => ({ ...await original(), getGarminActivities: vi.fn(), getGarminSleep: vi.fn(), getGarminSteps: vi.fn() }))

const sleep = { sleepTimeSeconds: 27000, deepSleepSeconds: 5400, lightSleepSeconds: 16200, remSleepSeconds: 5400, awakeSleepSeconds: 600, sleepScores: { overall: { value: 82 } } }
const activity = { activityId: 123, activityName: 'Morning run', activityType: { typeKey: 'running' }, startTimeLocal: '2026-10-22 07:30:00', distance: 5100, duration: 1800 }
function envelope(data) { return { data, meta: { source: 'cache', fetched_at: Date.now() / 1000 - 720, fresh_until: Date.now() / 1000 + 180, stale: false } } }
function card(name) { return within(screen.getByRole('region', { name })) }
function show() { return render(<MemoryRouter><GarminPage /></MemoryRouter>) }

beforeEach(() => {
  vi.resetAllMocks()
  auth.user = { accountId: 'one' }
  getGarminSteps.mockResolvedValue(envelope([{ calendarDate: localDate(), totalSteps: 4321 }]))
  getGarminSleep.mockResolvedValue(envelope(sleep))
  getGarminActivities.mockResolvedValue(envelope([activity]))
})
afterEach(() => cleanup())

describe('Sleep and recent activity overview', () => {
  it('shows sleep duration, score, stages, and activity summaries alongside steps', async () => {
    show()
    expect(await card('Sleep').findByText('7h 30m')).toBeInTheDocument()
    expect(card('Sleep').getByText('82/100')).toBeInTheDocument()
    expect(card('Sleep').getByText('Deep')).toBeInTheDocument()
    expect(card('Sleep').getByText('REM')).toBeInTheDocument()
    expect(await card('Recent activities').findByText('Morning run')).toBeInTheDocument()
    expect(card('Recent activities').getByText('30m')).toBeInTheDocument()
    expect(card('Recent activities').getByText('5.1 km')).toBeInTheDocument()
    expect(card('Recent activities').getByText('2026-10-22 07:30')).toBeInTheDocument()
    expect(await card('Daily steps').findByText('4,321')).toBeInTheDocument()
    expect(card('Sleep').getByText('Updated 12 minutes ago')).toBeInTheDocument()
  })

  it('keeps healthy cards usable when sleep fails', async () => {
    getGarminSleep.mockRejectedValue(new ApiError('Sleep unavailable.', 502, 'garmin_unavailable'))
    show()
    expect(await card('Sleep').findByRole('alert')).toHaveTextContent('Sleep unavailable.')
    expect(await card('Daily steps').findByText('4,321')).toBeInTheDocument()
    expect(await card('Recent activities').findByText('Morning run')).toBeInTheDocument()
    expect(card('Daily steps').getByRole('button', { name: 'Refresh steps' })).toBeEnabled()
    expect(card('Recent activities').getByRole('button', { name: 'Refresh activities' })).toBeEnabled()
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('refreshes only sleep and preserves its saved result if the refresh fails', async () => {
    const user = userEvent.setup()
    show()
    await card('Sleep').findByText('7h 30m')
    getGarminSleep.mockRejectedValueOnce(new ApiError('Sleep unavailable.', 502, 'garmin_unavailable'))
    await user.click(card('Sleep').getByRole('button', { name: 'Refresh sleep' }))
    expect(await card('Sleep').findByRole('alert')).toHaveTextContent('Showing saved data.')
    expect(card('Sleep').getByText('7h 30m')).toBeInTheDocument()
    expect(card('Sleep').getByText('Updated 12 minutes ago')).toBeInTheDocument()
    expect(getGarminSleep).toHaveBeenCalledTimes(2)
    expect(getGarminSleep).toHaveBeenLastCalledWith(localDate(), expect.objectContaining({ refresh: true }))
    expect(getGarminSteps).toHaveBeenCalledTimes(1)
    expect(getGarminActivities).toHaveBeenCalledTimes(1)
  })

  it('handles missing sleep, missing score, zero stages, and empty activity history honestly', async () => {
    getGarminSleep.mockResolvedValue(envelope({ dailySleepDTO: { ...sleep, remSleepSeconds: 0, sleepScores: null } }))
    getGarminActivities.mockResolvedValue(envelope([]))
    show()
    expect(await card('Sleep').findByText('7h 30m')).toBeInTheDocument()
    expect(card('Sleep').getByText('Unavailable')).toBeInTheDocument()
    expect(card('Sleep').getByText('0m')).toBeInTheDocument()
    expect(await card('Recent activities').findByText('No activities were returned for this 28-day period.')).toBeInTheDocument()
    cleanup()
    getGarminSleep.mockResolvedValue(envelope(null))
    show()
    expect(await card('Sleep').findByText('No sleep measurement is available for this date.')).toBeInTheDocument()
  })
})
