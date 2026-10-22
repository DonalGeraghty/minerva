import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivitiesCard, SleepCard, StepsCard } from '../components/GarminOverviewCards.jsx'
import { daysBefore, getGarminActivities, getGarminSleep, getGarminSteps, localDate } from '../services/garmin.js'
import { ApiError } from '../services/request.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'one' }, logout: vi.fn() } }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('../services/garminHealth.js', async (original) => ({ ...await original(), getPanelPreferences: vi.fn(async () => ({ preferences: { visible_panels: ['steps', 'sleep', 'activities'] } })) }))
vi.mock('../services/garmin.js', async (original) => ({ ...await original(), getGarminActivities: vi.fn(), getGarminSleep: vi.fn(), getGarminSteps: vi.fn() }))

const sleep = { sleepTimeSeconds: 27000, deepSleepSeconds: 5400, lightSleepSeconds: 16200, remSleepSeconds: 5400, awakeSleepSeconds: 600, sleepScores: { overall: { value: 82 } } }
const activity = { activityId: 123, activityName: 'Morning run', activityType: { typeKey: 'running' }, startTimeLocal: '2026-10-22 07:30:00', distance: 5100, duration: 1800 }
function envelope(data) { return { data, meta: { source: 'cache', fetched_at: Date.now() / 1000 - 720, fresh_until: Date.now() / 1000 + 180, stale: false } } }
function card(name) { return within(screen.getByRole('region', { name })) }
async function show() { return render(<MemoryRouter><StepsCard date={localDate()} now={Date.now()} /><SleepCard date={localDate()} now={Date.now()} /><ActivitiesCard date={localDate()} now={Date.now()} /></MemoryRouter>) }

beforeEach(() => {
  vi.resetAllMocks()
  auth.user = { accountId: 'one' }
  getGarminSteps.mockResolvedValue(envelope([{ calendarDate: localDate(), totalSteps: 4321 }]))
  getGarminSleep.mockResolvedValue(envelope([{ ...sleep, calendarDate: localDate() }]))
  getGarminActivities.mockResolvedValue(envelope([activity]))
})
afterEach(() => cleanup())

describe('Independent sleep, steps and activity cards', () => {
  it('shows sleep duration, score, stages, and activity summaries alongside steps', async () => {
    await show()
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
    await show()
    expect(await card('Sleep').findByRole('alert')).toHaveTextContent('Sleep unavailable.')
    expect(await card('Daily steps').findByText('4,321')).toBeInTheDocument()
    expect(await card('Recent activities').findByText('Morning run')).toBeInTheDocument()
    expect(card('Daily steps').getByRole('button', { name: 'Refresh steps' })).toBeEnabled()
    expect(card('Recent activities').getByRole('button', { name: 'Refresh activities' })).toBeEnabled()
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('refreshes only sleep and preserves its saved result if the refresh fails', async () => {
    const user = userEvent.setup()
    await show()
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
    getGarminSleep.mockResolvedValue(envelope([{ calendarDate: localDate(), ...sleep, remSleepSeconds: 0, sleepScores: null }]))
    getGarminActivities.mockResolvedValue(envelope([]))
    await show()
    expect(await card('Sleep').findByText('7h 30m')).toBeInTheDocument()
    expect(card('Sleep').getByText('Unavailable')).toBeInTheDocument()
    expect(card('Sleep').getByText('0m')).toBeInTheDocument()
    expect(await card('Recent activities').findByText('No activities were returned for this 28-day period.')).toBeInTheDocument()
    cleanup()
    getGarminSleep.mockResolvedValue(envelope([]))
    await show()
    expect(await card('Sleep').findByText('No sleep measurement is available for this date.')).toBeInTheDocument()
  })

  it('shows seven selectable nights, excludes missing nights from the average, and keeps dates distinct', async () => {
    const user = userEvent.setup()
    const today = localDate()
    const previous = daysBefore(today, 1)
    getGarminSleep.mockResolvedValue(envelope([
      { ...sleep, calendarDate: previous, sleepTimeSeconds: 21600, sleepScores: { overall: { value: 68 } } },
      { ...sleep, calendarDate: today },
    ]))
    await show()
    const chart = await card('Sleep').findByRole('group', { name: 'Sleep duration over seven days' })
    expect(within(chart).getAllByRole('button')).toHaveLength(7)
    expect(card('Sleep').getByText('Average 6h 45m across 2 recorded nights.')).toBeInTheDocument()
    expect(within(chart).getByRole('button', { name: `${today}: 7h 30m, sleep score 82/100` })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(chart).getByRole('button', { name: `${previous}: 6h 0m, sleep score 68/100` }))
    expect(card('Sleep').getByText(`Recorded for ${previous}`)).toBeInTheDocument()
    expect(card('Sleep').getByText('68/100')).toBeInTheDocument()
    await user.click(within(chart).getByRole('button', { name: `${daysBefore(today, 2)}: No sleep data` }))
    expect(card('Sleep').getByText('No sleep measurement is available for this date.')).toBeInTheDocument()
    expect(getGarminSleep).toHaveBeenCalledTimes(1)
  })
})
