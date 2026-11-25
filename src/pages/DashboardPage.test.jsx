import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from './DashboardPage.jsx'
import * as finance from '../services/finance.js'

vi.mock('../services/finance.js', async (original) => ({ ...await original(), getSyncStatus: vi.fn(), getSummary: vi.fn(), getCashflow: vi.fn() }))
const META = { snapshot_id: 'synthetic-snapshot', rule_set_version: 3, source: 'local_demo', coverage: { first_month: '2026-10', last_month: '2026-11', months: ['2026-10', '2026-11'] }, warnings: [] }
const SUMMARY = { meta: META, summary: { adjusted_totals: { net: '2017.66' }, period: { start: '2026-10', end: '2026-11' }, gaps: [], receipt_conflicts: [], provisional: false } }
const FLOW = { meta: META, cashflow: [{ month: '2026-10', net: '-950.00' }, { month: '2026-11', net: '2967.66' }] }
const STATUS = { sync: { snapshot_id: META.snapshot_id, stale: false, last_success_at: '2026-11-24T10:00:00Z' } }
function renderPage() { return render(<MemoryRouter><DashboardPage /></MemoryRouter>) }

describe('Dashboard waterfall', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    finance.getSyncStatus.mockResolvedValue(STATUS)
    finance.getSummary.mockResolvedValue(SUMMARY)
    finance.getCashflow.mockResolvedValue(FLOW)
  })
  afterEach(cleanup)

  it('supports custom whole-month dates and validates reversed ranges locally', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('group', { name: 'Monthly net cash flow waterfall' })
    expect(screen.getByRole('heading', { name: '€2,017.66' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Period'), 'custom')
    expect(screen.getByLabelText('From (YYYY-MM)')).toHaveValue('2026-10')
    await waitFor(() => expect(finance.getSummary).toHaveBeenCalledWith('custom', '2026-10', '2026-11', expect.any(AbortSignal)))
    const count = finance.getSummary.mock.calls.length
    fireEvent.change(screen.getByLabelText('From (YYYY-MM)'), { target: { value: '2026-12' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('start month must be before')
    expect(finance.getSummary).toHaveBeenCalledTimes(count)
    expect(screen.queryByRole('group', { name: 'Monthly net cash flow waterfall' })).not.toBeInTheDocument()
  })

  it('keeps a stale warning and gaps without inventing missing months', async () => {
    finance.getSyncStatus.mockResolvedValue({ sync: { ...STATUS.sync, stale: true } })
    finance.getSummary.mockResolvedValue({ ...SUMMARY, summary: { ...SUMMARY.summary, gaps: ['2026-09'] } })
    renderPage()
    expect(await screen.findByText(/Showing saved data/)).toBeInTheDocument()
    expect(screen.getByText(/These are gaps, not zero activity/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Sep 2026:/ })).not.toBeInTheDocument()
  })

  it('rejects mixed snapshot or rule versions after one retry', async () => {
    finance.getCashflow.mockResolvedValue({ ...FLOW, meta: { ...META, rule_set_version: 4 } })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('data changed while loading')
    expect(finance.getCashflow).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('group', { name: 'Monthly net cash flow waterfall' })).not.toBeInTheDocument()
  })

  it('shows an empty state for a period with no recorded activity', async () => {
    finance.getSummary.mockResolvedValue({ ...SUMMARY, summary: { ...SUMMARY.summary, adjusted_totals: { net: '0.00' } } })
    finance.getCashflow.mockResolvedValue({ ...FLOW, cashflow: [] })
    renderPage()
    expect(await screen.findByText('No recorded months in this period.')).toBeInTheDocument()
    expect(screen.queryByText('€0.00')).not.toBeInTheDocument()
  })

})
