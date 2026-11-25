import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FinanceConnectionSettings from './FinanceConnectionSettings.jsx'
import { deleteFinanceConnection, getFinanceConnection, saveFinanceConnection } from '../services/financeConnection.js'
import { ApiError } from '../services/request.js'
import { getSyncStatus, syncNow } from '../services/finance.js'
import { MemoryRouter } from 'react-router-dom'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'account-one' }, logout: vi.fn() } }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('../services/financeConnection.js', () => ({ getFinanceConnection: vi.fn(), saveFinanceConnection: vi.fn(), deleteFinanceConnection: vi.fn() }))
vi.mock('../services/finance.js', () => ({ getSyncStatus: vi.fn(), syncNow: vi.fn() }))

const WORKBOOK = 'synthetic-finance-workbook'
const SYNC = { snapshot_id: 'synthetic-snapshot', row_count: 48, fetched_at: '2026-11-24T12:00:00Z', last_success_at: '2026-11-24T12:00:00Z', coverage: { first_month: '2026-06', last_month: '2026-11' } }
function renderSettings() { return render(<MemoryRouter><FinanceConnectionSettings /></MemoryRouter>) }

describe('Finance connection settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.user = { accountId: 'account-one' }
    getFinanceConnection.mockResolvedValue({ connection: { connected: false } })
    saveFinanceConnection.mockResolvedValue({ connection: { connected: true, workbook_id: WORKBOOK, last_four: 'cdef' } })
    deleteFinanceConnection.mockResolvedValue({ connection: { connected: false, workbook_id: WORKBOOK } })
    getSyncStatus.mockResolvedValue({ sync: SYNC })
    syncNow.mockResolvedValue({ sync: SYNC })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('keeps the existing connection after a failed replacement and permits disconnect', async () => {
    const user = userEvent.setup()
    getFinanceConnection.mockResolvedValue({ connection: { connected: true, workbook_id: WORKBOOK, last_four: 'old4' } })
    saveFinanceConnection.mockRejectedValue(new ApiError('Secure credential storage is unavailable.', 503, 'credential_service_unavailable'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderSettings()
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

  it('confirms import only after completion and lets a failed import be retried', async () => {
    const user = userEvent.setup()
    let rejectImport
    syncNow.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectImport = reject }))
    renderSettings()
    await screen.findByText('Not connected')
    await user.type(screen.getByLabelText('Google OAuth access token (read-only)'), 'ya29.synthetic-token-abcdef')
    await user.type(screen.getByLabelText('Finance workbook ID'), WORKBOOK)
    await user.click(screen.getByRole('button', { name: 'Connect workbook' }))
    expect(screen.getByLabelText('Google OAuth access token (read-only)')).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('Importing transactions')
    expect(screen.queryByText(/Import complete:/)).not.toBeInTheDocument()
    rejectImport(new ApiError('Workbook unavailable.', 404, 'workbook_not_found'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Workbook connected, but data import failed.')
    expect(screen.getByText('Connected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Import data' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Import complete: 48 transactions imported.')
    expect(saveFinanceConnection).toHaveBeenCalledTimes(1)
    expect(syncNow).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('link', { name: 'Import your rules →' })).toHaveAttribute('href', '/rules')
  })

})
