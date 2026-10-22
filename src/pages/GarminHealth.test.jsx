import { MemoryRouter } from 'react-router-dom'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GarminPage from './GarminPage.jsx'
import { getGarminActivities, getGarminSleep, getGarminSteps, localDate, daysBefore } from '../services/garmin.js'
import { defaultPanels, healthLoaders, getPanelPreferences, savePanelPreferences, getActivityDetail } from '../services/garminHealth.js'
import { ApiError } from '../services/request.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'one' }, logout: vi.fn() } }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('../services/garmin.js', async (original) => ({ ...await original(), getGarminSteps: vi.fn(), getGarminSleep: vi.fn(), getGarminActivities: vi.fn() }))
vi.mock('../services/garminHealth.js', async (original) => {
  const module = await original()
  return { ...module, getPanelPreferences: vi.fn(), savePanelPreferences: vi.fn(), getActivityDetail: vi.fn(), healthLoaders: Object.fromEntries(module.healthPanels.map(([id]) => [id, vi.fn()])) }
})

const day = localDate()
function envelope(data) { return { data, meta: { source: 'cache', fetched_at: Date.now() / 1000 - 60, fresh_until: Date.now() / 1000 + 900, stale: false } } }
function show(tab = 'overview') { return render(<MemoryRouter><GarminPage tab={tab} /></MemoryRouter>) }
async function view(name) {
  const element = await screen.findByRole('region', { name })
  await waitFor(() => expect(element).toHaveAttribute('aria-busy', 'false'))
  return within(element)
}
function fixtureData() {
  return {
    stress: [{ calendarDate: day, stress: { avgLevel: 35, maxLevel: 70, qualifier: 'calm', highStressDurationInMillis: 3600000 } }],
    hrv: [{ calendarDate: day, lastNightAvg: 58, weeklyAvg: 56, status: 'BALANCED', baseline: { balancedLow: 35, balancedUpper: 65 } }],
    movement: [{ calendarDate: daysBefore(day, 1), movement: { steps: { value: 1000, distanceInMeters: 750 }, floorsAscended: { value: 2 } } }, { calendarDate: day, movement: JSON.stringify({ steps: { value: 2000, distanceInMeters: 1500 }, floorsAscended: { value: 3 } }), intensityMinutes: { moderate: 15, vigorous: 5 } }],
    weight: { dailyWeightSummaries: [{ summaryDate: day, latestWeight: { weight: 70.25, bmi: 23.4, bodyFat: 20.5 } }], totalAverage: { weight: 71 } },
    hydration: [{ calendarDate: day, valueInML: 1500, goalInML: 2000 }],
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  auth.user = { accountId: 'one' }
  getPanelPreferences.mockResolvedValue({ preferences: { visible_panels: defaultPanels } })
  savePanelPreferences.mockResolvedValue({})
  getGarminSteps.mockResolvedValue(envelope([{ calendarDate: day, totalSteps: 4321 }]))
  getGarminSleep.mockResolvedValue(envelope([]))
  getGarminActivities.mockResolvedValue(envelope([{ activityId: 123, activityName: 'Test run', activityType: { typeKey: 'running' }, duration: 1800, distance: 5000 }]))
  const fixtures = fixtureData()
  Object.entries(healthLoaders).forEach(([id, load]) => load.mockResolvedValue(envelope(fixtures[id])))
  getActivityDetail.mockImplementation(async (_, workouts) => envelope(workouts ? [] : { summaryDTO: { distance: 5000, averageHR: 150 }, splitSummaries: [{ distance: 1000, duration: 360, averageHR: 145 }] }))
})
afterEach(cleanup)

describe('Expanded Garmin dashboard', () => {
  it('shows all health panels using recorded values and documented units', async () => {
    show()
    expect((await view('Stress')).getByText('60 min')).toBeInTheDocument()
    expect((await view('HRV')).getByText(/35.*65 ms/)).toBeInTheDocument()
    expect((await view('Weight')).getByText('70.25 kg', { selector: 'dd' })).toBeInTheDocument()
    expect((await view('Hydration')).getByRole('progressbar')).toHaveAttribute('value', '1500')
    expect((await view('Weekly movement')).getByText('3,000')).toBeInTheDocument()
    expect((await view('Weekly movement')).getByText('2.25 km')).toBeInTheDocument()
    expect(getActivityDetail).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/)
  })

  it('waits for saved visibility before fetching, and persists changed panel choices', async () => {
    const user = userEvent.setup()
    let finish
    getPanelPreferences.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    show()
    expect(getGarminSteps).not.toHaveBeenCalled()
    expect(healthLoaders.hrv).not.toHaveBeenCalled()
    await act(async () => finish({ preferences: { visible_panels: ['sleep', 'hrv'] } }))
    await view('Sleep')
    expect(screen.queryByRole('region', { name: 'Daily steps' })).not.toBeInTheDocument()
    expect(healthLoaders.weight).not.toHaveBeenCalled()
    await user.click(screen.getByText('Manage panels'))
    await user.click(screen.getByRole('checkbox', { name: 'Hydration' }))
    await view('Hydration')
    await user.click(screen.getByRole('button', { name: 'Save panel choices' }))
    expect(savePanelPreferences).toHaveBeenCalledWith(['sleep', 'hrv', 'hydration'])
    expect(await screen.findByText('Panel choices saved to your account.')).toBeInTheDocument()
  })

  it('keeps sibling cards available on failure and refreshes only the failed panel', async () => {
    const user = userEvent.setup()
    healthLoaders.hrv.mockRejectedValueOnce(new ApiError('No HRV available.', 502, 'garmin_unavailable'))
    show()
    const hrv = await view('HRV')
    expect(hrv.getByRole('alert')).toHaveTextContent('No HRV available.')
    expect((await view('Hydration')).getByText('1,500 ml', { selector: 'dd' })).toBeInTheDocument()
    await user.click(hrv.getByRole('button', { name: 'Refresh hrv' }))
    expect(await hrv.findByText('58 ms', { selector: 'dd' })).toBeInTheDocument()
    expect(healthLoaders.hrv).toHaveBeenLastCalledWith(day, expect.objectContaining({ refresh: true }))
    expect(healthLoaders['hydration']).toHaveBeenCalledTimes(1)
    expect(healthLoaders.weight).toHaveBeenCalledTimes(1)
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('keeps unsaved visibility on save failure and restores saved choices on reload', async () => {
    const user = userEvent.setup()
    getPanelPreferences.mockResolvedValue({ preferences: { visible_panels: ['sleep'] } })
    savePanelPreferences.mockRejectedValueOnce(new ApiError('Unavailable', 503, 'garmin_storage_unavailable'))
    show()
    await view('Sleep')
    await user.click(screen.getByText('Manage panels'))
    await user.click(screen.getByRole('checkbox', { name: 'Hydration' }))
    await view('Hydration')
    await user.click(screen.getByRole('button', { name: 'Save panel choices' }))
    expect(await screen.findByText(/Could not save panel choices/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Hydration' })).toBeChecked()
    cleanup()
    healthLoaders['hydration'].mockClear()
    show()
    await view('Sleep')
    expect(screen.queryByRole('region', { name: 'Hydration' })).not.toBeInTheDocument()
    expect(healthLoaders['hydration']).not.toHaveBeenCalled()
  })

  it('ignores late preferences from an account that is no longer signed in', async () => {
    let finishOld
    getPanelPreferences.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve }))
    const app = show()
    auth.user = { accountId: 'two' }
    getPanelPreferences.mockResolvedValue({ preferences: { visible_panels: ['hydration'] } })
    app.rerender(<MemoryRouter><GarminPage /></MemoryRouter>)
    await view('Hydration')
    await act(async () => finishOld({ preferences: { visible_panels: ['sleep'] } }))
    expect(screen.queryByRole('region', { name: 'Sleep' })).not.toBeInTheDocument()
    expect(healthLoaders.hrv).not.toHaveBeenCalled()
  })

  it('handles empty measurements without invented readings', async () => {
    Object.values(healthLoaders).forEach((load) => load.mockResolvedValue(envelope(null)))
    show()
    const weight = await view('Weight')
    expect(weight.getByText('No weight measurements in this 28-day window.')).toBeInTheDocument()
    expect(weight.getAllByText('Unavailable').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/)
  })

  it('loads full activity measurements and workouts only when requested', async () => {
    const user = userEvent.setup()
    show('activities')
    const activities = await view('Recent activities')
    await user.click(activities.getByText('Activity details · Test run'))
    await user.click(activities.getByRole('button', { name: 'Explore full activity' }))
    const full = await view('Full activity measurements')
    expect(full.getByText('150 bpm')).toBeInTheDocument()
    expect(full.getByText('145 bpm')).toBeInTheDocument()
    expect((await view('Associated workouts')).getByText('No workouts are associated with this activity.')).toBeInTheDocument()
    expect(getActivityDetail).toHaveBeenCalledWith(123, false, expect.objectContaining({ refresh: false }))
    expect(getActivityDetail).toHaveBeenCalledWith(123, true, expect.objectContaining({ refresh: false }))
    await user.click(activities.getByRole('button', { name: 'Close full activity' }))
    expect(screen.queryByRole('region', { name: 'Full activity measurements' })).not.toBeInTheDocument()
  })
})
