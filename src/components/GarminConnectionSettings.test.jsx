import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GarminConnectionSettings from './GarminConnectionSettings.jsx'
import { disconnectGarmin, getGarminConnection, saveGarminConnection } from '../services/garmin.js'
import { ApiError } from '../services/request.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'account-one' }, logout: vi.fn() } }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('../services/garmin.js', () => ({ getGarminConnection: vi.fn(), saveGarminConnection: vi.fn(), disconnectGarmin: vi.fn() }))

describe('Garmin connection settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.user = { accountId: 'account-one' }
    getGarminConnection.mockResolvedValue({ connection: { configured: false } })
    saveGarminConnection.mockResolvedValue({ connection: { configured: true, last_four: '1234' } })
    disconnectGarmin.mockResolvedValue({ connection: { configured: false } })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('connects a key without retaining it in the input', async () => {
    const user = userEvent.setup()
    render(<GarminConnectionSettings />)
    await screen.findByText('Not connected')
    await user.type(screen.getByLabelText('Garmin personal API key'), 'synthetic-key-1234')
    await user.click(screen.getByRole('button', { name: 'Connect Garmin' }))
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(screen.getByLabelText('Garmin personal API key')).toHaveValue('')
    expect(saveGarminConnection).toHaveBeenCalledWith('synthetic-key-1234', expect.any(AbortSignal))
    expect(screen.getByText('1234')).toBeInTheDocument()
  })

  it('keeps the existing connection visible after a bad replacement and permits disconnect', async () => {
    const user = userEvent.setup()
    getGarminConnection.mockResolvedValue({ connection: { configured: true, last_four: 'old4' } })
    saveGarminConnection.mockRejectedValue(new ApiError('Garmin rejected this key.', 409, 'garmin_reconnect_required'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<GarminConnectionSettings />)
    await screen.findByText('old4')
    await user.type(screen.getByLabelText('Garmin personal API key'), 'bad-key')
    await user.click(screen.getByRole('button', { name: 'Replace Garmin key' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Garmin rejected this key.')
    expect(screen.getByText('old4')).toBeInTheDocument()
    expect(auth.logout).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Disconnect Garmin' }))
    expect(await screen.findByText('Not connected')).toBeInTheDocument()
    expect(window.confirm).toHaveBeenCalled()
  })

  it('can retry an unavailable status request', async () => {
    const user = userEvent.setup()
    getGarminConnection.mockRejectedValueOnce(new Error('Janus unavailable'))
    render(<GarminConnectionSettings />)
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Retry connection status' }))
    await waitFor(() => expect(screen.getByText('Not connected')).toBeInTheDocument())
  })

  it('never accepts credentials in demo mode', () => {
    auth.user = { accountId: 'demo', isDemo: true }
    render(<GarminConnectionSettings />)
    expect(screen.queryByLabelText('Garmin personal API key')).not.toBeInTheDocument()
    expect(getGarminConnection).not.toHaveBeenCalled()
  })
})
