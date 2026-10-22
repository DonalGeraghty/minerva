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

describe('Garmin dashboard navigation', () => {
  it.each(['/', '/ask', '/flashcards', '/gallery'])('opens the dashboard for %s', async (path) => {
    open(path)
    expect(await screen.findByRole('heading', { name: 'Dashboard.' })).toBeInTheDocument()
    await waitFor(() => expect(getGarminSteps).toHaveBeenCalled())
    expect(window.location.pathname).toBe('/')
    expect(navigation().getAllByRole('link')).toHaveLength(3)
    expect(navigation().getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows all seven detailed panels with charts, and leaves activities on its own tab', async () => {
    healthLoaders.hrv.mockResolvedValue(response([{ calendarDate: localDate(), lastNightAvg: 55 }]))
    open()
    await screen.findByRole('region', { name: 'Hydration' })
    expect(screen.getAllByRole('region')).toHaveLength(7)
    await waitFor(() => expect(screen.getByRole('region', { name: 'HRV' })).toHaveAttribute('aria-busy', 'false'))
    expect(screen.getByRole('group', { name: 'Sleep duration over seven days' })).toBeInTheDocument()
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0)
    Object.values(healthLoaders).forEach((load) => expect(load).toHaveBeenCalledTimes(1))
    expect(getGarminActivities).not.toHaveBeenCalled()
    for (const name of ['Heart rate', 'Body Battery', 'Fitness age', 'Recent activities']) expect(screen.queryByRole('region', { name })).not.toBeInTheDocument()
  })

  it('loads only activities when opening Activities directly, regardless of hidden dashboard panels', async () => {
    open('/activities')
    expect(screen.getByRole('heading', { name: 'Activities.' })).toBeInTheDocument()
    await waitFor(() => expect(getGarminActivities).toHaveBeenCalledTimes(1))
    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(getPanelPreferences).not.toHaveBeenCalled()
    expect(getGarminSteps).not.toHaveBeenCalled()
    expect(getGarminSleep).not.toHaveBeenCalled()
    Object.values(healthLoaders).forEach((load) => expect(load).not.toHaveBeenCalled())
    expect(navigation().getByRole('link', { name: 'Activities' })).toHaveAttribute('aria-current', 'page')
  })

  it.each(['/recovery', '/health', '/movement'])('redirects old %s links and retains their date and anchor', async (path) => {
    open(`${path}?date=2026-01-02#sleep`)
    await screen.findByRole('region', { name: 'Sleep' })
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('?date=2026-01-02')
    expect(window.location.hash).toBe('#sleep')
    expect(screen.getByLabelText('Calendar date')).toHaveValue('2026-01-02')
  })

  it('remembers separate dates for the dashboard and activities', async () => {
    const user = userEvent.setup()
    open()
    await screen.findByRole('region', { name: 'Sleep' })
    fireEvent.change(screen.getByLabelText('Calendar date'), { target: { value: '2026-01-02' } })
    await user.click(navigation().getByRole('link', { name: 'Activities' }))
    expect(screen.getByLabelText('Calendar date')).toHaveValue(localDate())
    fireEvent.change(screen.getByLabelText('Calendar date'), { target: { value: '2026-02-03' } })
    await user.click(navigation().getByRole('link', { name: 'Dashboard' }))
    expect(screen.getByLabelText('Calendar date')).toHaveValue('2026-01-02')
    await user.click(navigation().getByRole('link', { name: 'Activities' }))
    expect(screen.getByLabelText('Calendar date')).toHaveValue('2026-02-03')
  })

  it('keeps Activities accessible with every dashboard panel hidden', async () => {
    const user = userEvent.setup()
    getPanelPreferences.mockResolvedValue({ preferences: { visible_panels: [] } })
    open()
    expect(await screen.findByText(/No dashboard panels selected/)).toBeInTheDocument()
    expect(getGarminSleep).not.toHaveBeenCalled()
    await user.click(navigation().getByRole('link', { name: 'Activities' }))
    expect(screen.getByRole('region', { name: 'Recent activities' })).toBeInTheDocument()
    expect(getGarminActivities).toHaveBeenCalledTimes(1)
  })

  it('aborts dashboard reads on navigation and ignores late data', async () => {
    const user = userEvent.setup()
    let finish, signal
    healthLoaders.weight.mockImplementationOnce((_, options) => { signal = options.signal; return new Promise((resolve) => { finish = resolve }) })
    open()
    await screen.findByRole('region', { name: 'Weight' })
    await user.click(navigation().getByRole('link', { name: 'Activities' }))
    expect(signal.aborted).toBe(true)
    await act(async () => finish(response({ dailyWeightSummaries: [] })))
    expect(screen.queryByRole('region', { name: 'Weight' })).not.toBeInTheDocument()
  })

  it('ignores invalid deep-link dates and keeps demo tabs offline', async () => {
    open('/?date=2026-02-30')
    expect(screen.getByLabelText('Calendar date')).toHaveValue(localDate())
    cleanup()
    vi.clearAllMocks()
    auth.user = { accountId: 'demo', isDemo: true }
    open('/activities')
    expect(screen.getByText(/This demo does not contact Garmin/)).toBeInTheDocument()
    expect(getPanelPreferences).not.toHaveBeenCalled()
    expect(getGarminActivities).not.toHaveBeenCalled()
    Object.values(healthLoaders).forEach((load) => expect(load).not.toHaveBeenCalled())
  })
})
