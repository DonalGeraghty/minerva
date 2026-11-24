import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from './DashboardPage.jsx'
import * as finance from '../services/finance.js'
import { ApiError } from '../services/request.js'

vi.mock('../services/finance.js', async (original) => {
  const module = await original()
  return {
    ...module,
    getSyncStatus: vi.fn(), syncNow: vi.fn(), getSummary: vi.fn(), getCashflow: vi.fn(),
    getTrends: vi.fn(), getCategories: vi.fn(),
  }
})

const SUMMARY = {
  meta: { snapshot_id: 'snap1234abcd', rule_set_version: 3, source: 'google_sheets', coverage: { months: ['2026-11'], last_month: '2026-11' }, warnings: [] },
  summary: {
    adjusted_totals: { income: '4000.00', spending: '-1032.34', refunds: '0.00', net: '2967.66', transfers: '0.00', investment: '0.00' },
    sheet_totals: { income: '4000.00', spending: '-1032.34', refunds: '0.00', net: '2967.66', transfers: '0.00', investment: '0.00' },
    reconciliation_bridge: { income: '0.00', spending: '0.00', refunds: '0.00', net: '0.00' },
    gaps: [], receipt_conflicts: [], provisional: false,
  },
}
const STATUS = { sync: { last_success_at: '2026-11-24T10:00:00+00:00', stale: false, error: null, snapshot_id: 'snap1234abcd', row_count: 3, coverage: { months: ['2026-10', '2026-11'], last_month: '2026-11' } } }

async function renderPage() {
  return render(<MemoryRouter><DashboardPage /></MemoryRouter>)
}

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    finance.getSyncStatus.mockResolvedValue(STATUS)
    finance.getSummary.mockResolvedValue(SUMMARY)
    finance.getCashflow.mockResolvedValue({ cashflow: [{ month: '2026-11', net: '2967.66' }, { month: '2026-10', net: '-950.00' }] })
    finance.getTrends.mockResolvedValue({ trends: [{ month: '2026-11', income: '4000.00', spending: '-1032.34', refunds: '0.00', net: '2967.66' }] })
    finance.getCategories.mockResolvedValue({ categories: [{ name: 'Groceries', total: '-82.34', count: 1 }] })
  })
  afterEach(() => cleanup())

  it('shows totals, waterfall, trend and top categories with pinned versions', async () => {
    await renderPage()
    expect(await screen.findByText('€4,000.00')).toBeInTheDocument()
    expect(screen.getAllByText('€2,967.66').length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: 'Monthly net cash flow waterfall' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Net cash flow trend' })).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText(/rule set v3/)).toBeInTheDocument()
    expect(screen.getByText(/Ledger synced/)).toBeInTheDocument()
    expect(finance.getSummary).toHaveBeenCalledWith('this_month', '', '', expect.any(AbortSignal))
  })

  it('prompts to sync when the backend says sync_required', async () => {
    const user = userEvent.setup()
    finance.getSyncStatus.mockResolvedValue(STATUS)
    finance.getSummary.mockRejectedValue(new ApiError('Sync the ledger first (POST /api/finance/sync).', 409, 'sync_required'))
    finance.getCashflow.mockRejectedValue(new ApiError('Sync the ledger first (POST /api/finance/sync).', 409, 'sync_required'))
    finance.getTrends.mockRejectedValue(new ApiError('Sync the ledger first (POST /api/finance/sync).', 409, 'sync_required'))
    finance.getCategories.mockRejectedValue(new ApiError('Sync the ledger first (POST /api/finance/sync).', 409, 'sync_required'))
    finance.syncNow.mockResolvedValue({ sync: { row_count: 3, snapshot_id: 'snap1234abcd', stale: false } })
    await renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Sync the ledger first')
    await user.click(screen.getAllByRole('button', { name: 'Sync now' })[0])
    await waitFor(() => expect(finance.syncNow).toHaveBeenCalled())
  })

  it('links to Account when the account has no finance connection', async () => {
    finance.getSyncStatus.mockRejectedValue(new ApiError('Connect your own Google Sheets workbook first (Account, Finance connection).', 403, 'finance_not_connected'))
    finance.getSummary.mockRejectedValue(new ApiError('Connect your own Google Sheets workbook first (Account, Finance connection).', 403, 'finance_not_connected'))
    finance.getCashflow.mockRejectedValue(new ApiError('x', 403, 'finance_not_connected'))
    finance.getTrends.mockRejectedValue(new ApiError('x', 403, 'finance_not_connected'))
    finance.getCategories.mockRejectedValue(new ApiError('x', 403, 'finance_not_connected'))
    await renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Connect your own Google Sheets workbook first')
    expect(screen.getByRole('link', { name: 'Connect your workbook in Account.' })).toHaveAttribute('href', '/account')
  })

  it('shows a stale warning when the latest sync failed', async () => {
    finance.getSyncStatus.mockResolvedValue({ sync: { ...STATUS.sync, stale: true, error: 'sheets_unreachable' } })
    await renderPage()
    expect(await screen.findByText(/showing saved data/)).toBeInTheDocument()
  })
})
