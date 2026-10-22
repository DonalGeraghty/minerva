import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GarminPage from './GarminPage.jsx'
import { getGarminActivities, getGarminSleep, getGarminSteps, localDate } from '../services/garmin.js'
import { ApiError } from '../services/request.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'account-one' }, logout: vi.fn() } }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('../services/garminHealth.js', async (original) => ({ ...await original(), getPanelPreferences: vi.fn(async () => ({ preferences: { visible_panels: ['steps', 'sleep', 'activities'] } })) }))
vi.mock('../services/garmin.js', async (original) => ({ ...await original(), getGarminSteps: vi.fn(), getGarminSleep: vi.fn(), getGarminActivities: vi.fn() }))

function response(data = [{ calendarDate: localDate(), totalSteps: 4321, stepGoal: 8000 }]) {
  return { data, meta: { source: 'cache', fetched_at: Date.now() / 1000 - 720, fresh_until: Date.now() / 1000 + 180, stale: false, warning: null } }
}
function stepsView() { return within(screen.getByRole('region', { name: 'Daily steps' })) }
async function show() { const view = render(<MemoryRouter><GarminPage /></MemoryRouter>); if (!auth.user?.isDemo) await screen.findByRole('region', { name: 'Daily steps' }); return view }

describe('Garmin steps overview', () => {
  beforeEach(() => { vi.resetAllMocks(); auth.user = { accountId: 'account-one' }; getGarminSteps.mockResolvedValue(response()); getGarminSleep.mockResolvedValue(response(null)); getGarminActivities.mockResolvedValue(response([])) })
  afterEach(() => cleanup())

  it('shows steps, freshness, the goal, and the exact timestamp', async () => {
    await show()
    expect(await stepsView().findByText('4,321')).toBeInTheDocument()
    expect(stepsView().getByText(/daily goal: 8,000 steps/i)).toBeInTheDocument()
    expect(stepsView().getByText('Updated 12 minutes ago')).toHaveAttribute('datetime')
    expect(stepsView().getByText('Saved copy')).toBeInTheDocument()
    expect(stepsView().getByText('Exact update time and returned data')).toBeInTheDocument()
    expect(getGarminSteps).toHaveBeenCalledWith(localDate(), expect.objectContaining({ refresh: false }))
  })

  it('refreshes explicitly while preserving the old measurement and timestamp on failure', async () => {
    const user = userEvent.setup()
    await show()
    await stepsView().findByText('4,321')
    let fail
    getGarminSteps.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject }))
    await user.click(stepsView().getByRole('button', { name: 'Refresh steps' }))
    expect(stepsView().getByText('4,321')).toBeInTheDocument()
    expect(stepsView().getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
    fail(new ApiError('Garmin is unavailable.', 502, 'garmin_unavailable'))
    expect(await stepsView().findByRole('alert')).toHaveTextContent('Showing saved data. Garmin is unavailable.')
    expect(stepsView().getByText('Updated 12 minutes ago')).toBeInTheDocument()
    expect(getGarminSteps).toHaveBeenLastCalledWith(localDate(), expect.objectContaining({ refresh: true }))
  })

  it('shows a backend saved-after-error response and reconnect link without logout', async () => {
    const saved = response()
    saved.meta.stale = true
    saved.meta.warning = { code: 'garmin_reconnect_required', message: 'Replace your key.', retry_after: 30 }
    getGarminSteps.mockResolvedValue(saved)
    await show()
    expect(await stepsView().findByRole('alert')).toHaveTextContent('Showing saved data. Replace your key.')
    expect(stepsView().getByRole('link', { name: /replace your Garmin key/i })).toHaveAttribute('href', '/account')
    expect(stepsView().getByRole('button', { name: /Refresh in/ })).toBeDisabled()
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('distinguishes zero steps from a missing measurement', async () => {
    const user = userEvent.setup()
    getGarminSteps.mockResolvedValueOnce(response([{ calendarDate: localDate(), totalSteps: 0 }])).mockResolvedValueOnce(response([]))
    await show()
    expect(await stepsView().findByText('0')).toBeInTheDocument()
    await user.click(stepsView().getByRole('button', { name: 'Refresh steps' }))
    expect(await stepsView().findByText('No steps measurement is available for this date.')).toBeInTheDocument()
    expect(stepsView().getByText('—')).toBeInTheDocument()
  })

  it('ignores a late response after date navigation', async () => {
    const { fireEvent } = await import('@testing-library/react')
    let finish
    getGarminSteps.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve })).mockResolvedValueOnce(response([{ calendarDate: '2026-01-02', totalSteps: 100 }]))
    await show()
    fireEvent.change(screen.getByLabelText('Calendar date'), { target: { value: '2026-01-02' } })
    expect(await stepsView().findByText('100')).toBeInTheDocument()
    finish(response())
    await waitFor(() => expect(stepsView().queryByText('4,321')).not.toBeInTheDocument())
  })

  it('requests connection setup on first load and preserves Janus login', async () => {
    getGarminSteps.mockRejectedValue(new ApiError('Connect Garmin.', 409, 'garmin_connection_required'))
    await show()
    expect(await stepsView().findByRole('link', { name: 'Connect Garmin in Account' })).toHaveAttribute('href', '/account')
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('does not request real data for the demo account', async () => {
    auth.user = { accountId: 'demo', isDemo: true }
    await show()
    expect(screen.getByText(/This demo does not contact Garmin/)).toBeInTheDocument()
    expect(getGarminSteps).not.toHaveBeenCalled()
  })
})
