import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FinanceConnectionSettings from './FinanceConnectionSettings.jsx'
import { deleteFinanceConnection, getFinanceConnection, saveFinanceConnection } from '../services/financeConnection.js'
import { ApiError } from '../services/request.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'account-one' }, logout: vi.fn() } }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('../services/financeConnection.js', () => ({ getFinanceConnection: vi.fn(), saveFinanceConnection: vi.fn(), deleteFinanceConnection: vi.fn() }))

const WORKBOOK = '1RUiRPyU2DnoXe5Tbhd6BZXMCdJtxg7FP3UQwCd2i_e0'

describe('Finance connection settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.user = { accountId: 'account-one' }
    getFinanceConnection.mockResolvedValue({ connection: { connected: false } })
    saveFinanceConnection.mockResolvedValue({ connection: { connected: true, workbook_id: WORKBOOK, last_four: 'cdef' } })
    deleteFinanceConnection.mockResolvedValue({ connection: { connected: false, workbook_id: WORKBOOK } })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('connects a token and workbook without retaining the token in the input', async () => {
    const user = userEvent.setup()
    render(<FinanceConnectionSettings />)
    await screen.findByText('Not connected')
    await user.type(screen.getByLabelText('Google OAuth access token (read-only)'), 'ya29.synthetic-token-abcdef')
    await user.type(screen.getByLabelText('Finance workbook ID'), WORKBOOK)
    await user.click(screen.getByRole('button', { name: 'Connect workbook' }))
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(screen.getByLabelText('Google OAuth access token (read-only)')).toHaveValue('')
    expect(saveFinanceConnection).toHaveBeenCalledWith('ya29.synthetic-token-abcdef', WORKBOOK, expect.any(AbortSignal))
    expect(screen.getByText('cdef')).toBeInTheDocument()
  })

  it('keeps the existing connection after a failed replacement and permits disconnect', async () => {
    const user = userEvent.setup()
    getFinanceConnection.mockResolvedValue({ connection: { connected: true, workbook_id: WORKBOOK, last_four: 'old4' } })
    saveFinanceConnection.mockRejectedValue(new ApiError('Secure credential storage is unavailable.', 503, 'credential_service_unavailable'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<FinanceConnectionSettings />)
    await screen.findByText('old4')
    await user.type(screen.getByLabelText('Google OAuth access token (read-only)'), 'bad-token-value-123')
    await user.click(screen.getByRole('button', { name: 'Replace token' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Secure credential storage is unavailable.')
    expect(screen.getByText('old4')).toBeInTheDocument()
    expect(auth.logout).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(await screen.findByText('Not connected')).toBeInTheDocument()
    expect(deleteFinanceConnection).toHaveBeenCalledWith(expect.any(AbortSignal))
  })

  it('logs out on 401 and stays offline in demo mode', async () => {
    getFinanceConnection.mockRejectedValue(new ApiError('Sign in to continue.', 401, 'unauthorized'))
    render(<FinanceConnectionSettings />)
    await waitFor(() => expect(auth.logout).toHaveBeenCalled())
    cleanup()
    vi.clearAllMocks()
    auth.user = { accountId: 'demo', isDemo: true }
    render(<FinanceConnectionSettings />)
    expect(await screen.findByText(/Demo mode never sends Google credentials/)).toBeInTheDocument()
    expect(getFinanceConnection).not.toHaveBeenCalled()
  })
})
