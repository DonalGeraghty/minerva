import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { getGarminSteps, getGarminSleep, getGarminActivities, localDate } from './services/garmin.js'
import { defaultPanels, getPanelPreferences, healthLoaders } from './services/garminHealth.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'account-one' }, logout: vi.fn() } }))
vi.mock('./context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('./services/garminHealth.js', async (original) => {
  const module = await original()
  return { ...module, getPanelPreferences: vi.fn(), healthLoaders: Object.fromEntries(module.healthPanels.map(([id]) => [id, vi.fn()])) }
})
vi.mock('./services/garmin.js', async (original) => ({ ...await original(), getGarminSteps: vi.fn(async () => ({ data: [], meta: { source: 'cache', fetched_at: 1, fresh_until: 2 } })), getGarminSleep: vi.fn(async () => ({ data: null, meta: { source: 'cache', fetched_at: 1, fresh_until: 2 } })), getGarminActivities: vi.fn(async () => ({ data: [], meta: { source: 'cache', fetched_at: 1, fresh_until: 2 } })) }))
vi.mock('./pages/AccountPage.jsx', () => ({ default: () => <div>Account settings</div> }))

function response(data) { return { data, meta: { source: 'cache', fetched_at: 1, fresh_until: Date.now() / 1000 + 900 } } }
function open(path = '/') { window.history.replaceState({}, '', path); return render(<App />) }
function navigation() { return within(screen.getByRole('navigation', { name: 'Primary navigation' })) }
beforeEach(() => {
  vi.resetAllMocks()
  auth.user = { accountId: 'account-one' }
  getPanelPreferences.mockResolvedValue({ preferences: { visible_panels: defaultPanels } })
  getGarminSteps.mockResolvedValue(response([]))
  getGarminSleep.mockResolvedValue(response([]))
  getGarminActivities.mockResolvedValue(response([]))
  Object.values(healthLoaders).forEach((load) => load.mockResolvedValue(response(null)))
})
afterEach(cleanup)

describe('Garmin-only navigation', () => {
  it.each(['/', '/ask', '/flashcards', '/gallery'])('opens the dashboard for %s without study endpoints', async (path) => {
    open(path)
    expect(await screen.findByRole('heading', { name: 'Overview.' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    await waitFor(() => expect(getGarminSteps).toHaveBeenCalled())
    expect(screen.getByRole('navigation', { name: 'Primary navigation' }).querySelectorAll('a')).toHaveLength(6)
    expect(screen.queryByRole('link', { name: /flashcards|gallery|ask/i })).not.toBeInTheDocument()
  })

  it('keeps Overview to five linked summaries and does not mount detailed charts', async () => {
    open()
    await screen.findByRole('region', { name: 'Latest activity' })
    expect(screen.getAllByRole('region')).toHaveLength(5)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Sleep duration over seven days' })).not.toBeInTheDocument()
    for (const resource of ['stress', 'hrv', 'movement', 'weight', 'hydration', 'fitness-age']) expect(healthLoaders[resource]).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /View sleep in Recovery/ })).toHaveAttribute('href', `/recovery?date=${localDate()}#sleep`)
  })

  it.each([
    ['/recovery', 'Recovery.', ['Sleep', 'Body Battery', 'Stress', 'HRV'], ['body-battery', 'stress', 'hrv'], true, false, false],
    ['/activities', 'Activities.', ['Recent activities'], [], false, true, false],
    ['/health', 'Health.', ['Heart rate', 'Weight', 'Hydration', 'Fitness age'], ['heart-rate', 'weight', 'hydration', 'fitness-age'], false, false, false],
    ['/movement', 'Movement.', ['Daily steps', 'Weekly movement'], ['movement'], false, false, true],
  ])('opens %s directly and requests only the data used by that tab', async (path, heading, panels, resources, sleep, activities, steps) => {
    open(path)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    for (const name of panels) expect(screen.getByRole('region', { name })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('region', { name: panels[0] })).toHaveAttribute('aria-busy', 'false'))
    expect(getPanelPreferences).not.toHaveBeenCalled()
    expect(getGarminSleep).toHaveBeenCalledTimes(sleep ? 1 : 0)
    expect(getGarminActivities).toHaveBeenCalledTimes(activities ? 1 : 0)
    expect(getGarminSteps).toHaveBeenCalledTimes(steps ? 1 : 0)
    Object.entries(healthLoaders).forEach(([id, load]) => expect(load).toHaveBeenCalledTimes(resources.includes(id) ? 1 : 0))
    expect(navigation().getByRole('link', { name: heading.slice(0, -1) })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByText('Manage panels')).not.toBeInTheDocument()
  })

  it('remembers separate tab dates and carries the summary date into a linked detail tab', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByRole('region', { name: 'Sleep' })
    fireEvent.change(screen.getByLabelText('Calendar date'), { target: { value: '2026-01-02' } })
    await user.click(screen.getByRole('link', { name: /View sleep in Recovery/ }))
    expect(await screen.findByRole('heading', { name: 'Recovery.' })).toBeInTheDocument()
    expect(screen.getByLabelText('Calendar date')).toHaveValue('2026-01-02')
    expect(window.location.hash).toBe('#sleep')
    await user.click(navigation().getByRole('link', { name: 'Health' }))
    expect(screen.getByLabelText('Calendar date')).toHaveValue(localDate())
    fireEvent.change(screen.getByLabelText('Calendar date'), { target: { value: '2026-02-03' } })
    await user.click(navigation().getByRole('link', { name: 'Recovery' }))
    expect(screen.getByLabelText('Calendar date')).toHaveValue('2026-01-02')
    await user.click(navigation().getByRole('link', { name: 'Health' }))
    expect(screen.getByLabelText('Calendar date')).toHaveValue('2026-02-03')
  })

  it('exposes full tabs when Overview summaries are all hidden', async () => {
    const user = userEvent.setup()
    getPanelPreferences.mockResolvedValue({ preferences: { visible_panels: [] } })
    open()
    expect(await screen.findByText(/No overview summaries selected/)).toBeInTheDocument()
    expect(getGarminSleep).not.toHaveBeenCalled()
    await user.click(navigation().getByRole('link', { name: 'Recovery' }))
    expect(screen.getByRole('region', { name: 'Sleep' })).toBeInTheDocument()
    expect(getGarminSleep).toHaveBeenCalledTimes(1)
  })

  it('aborts reads from a tab that was closed and ignores late data', async () => {
    const user = userEvent.setup()
    let finish, signal
    healthLoaders.weight.mockImplementationOnce((_, options) => { signal = options.signal; return new Promise((resolve) => { finish = resolve }) })
    open('/health')
    expect(screen.getByRole('region', { name: 'Weight' })).toHaveAttribute('aria-busy', 'true')
    await user.click(navigation().getByRole('link', { name: 'Activities' }))
    expect(signal.aborted).toBe(true)
    await act(async () => finish(response({ dailyWeightSummaries: [] })))
    expect(screen.queryByRole('region', { name: 'Weight' })).not.toBeInTheDocument()
  })

  it('ignores an invalid date deep link and keeps demo tabs offline', async () => {
    open('/recovery?date=2026-02-30')
    expect(screen.getByLabelText('Calendar date')).toHaveValue(localDate())
    cleanup()
    vi.clearAllMocks()
    auth.user = { accountId: 'demo', isDemo: true }
    open('/health')
    expect(screen.getByText(/This demo does not contact Garmin/)).toBeInTheDocument()
    expect(getPanelPreferences).not.toHaveBeenCalled()
    Object.values(healthLoaders).forEach((load) => expect(load).not.toHaveBeenCalled())
  })
})
