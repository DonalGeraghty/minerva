import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TransactionsPage from './TransactionsPage.jsx'
import { getTransactions } from '../services/finance.js'

vi.mock('../services/finance.js', async (original) => ({ ...await original(), getTransactions: vi.fn() }))
const META = { snapshot_id: 'synthetic-snapshot', rule_set_version: 1, coverage: { months: ['2026-10', '2026-11'] } }
function result(offset = 0) {
  return { meta: META, total: 100, transactions: [{ row: offset + 1, transaction_id: `T-${offset}`, date: '2026-11-01', description: 'Example payment', amount_eur: null, derived: { effective_budget_amount_eur: null } }] }
}
function renderPage() { return render(<MemoryRouter><TransactionsPage /></MemoryRouter>) }

describe('Ledger', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getTransactions.mockImplementation(async ({ offset }) => result(offset))
  })
  afterEach(cleanup)

  it('returns to the first page when either custom date changes', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('T-0')
    expect(screen.getAllByText('Unavailable')).toHaveLength(2)
    expect(screen.queryByText('€0.00')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Period'), 'custom')
    fireEvent.change(screen.getByLabelText('From (YYYY-MM)'), { target: { value: '2026-10' } })
    fireEvent.change(screen.getByLabelText('To (YYYY-MM)'), { target: { value: '2026-11' } })
    await screen.findByText('T-0')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('T-50')
    fireEvent.change(screen.getByLabelText('From (YYYY-MM)'), { target: { value: '2026-09' } })
    await waitFor(() => expect(getTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ start: '2026-09', offset: 0 }), expect.any(AbortSignal)))
    await screen.findByText('T-0')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('T-50')
    fireEvent.change(screen.getByLabelText('To (YYYY-MM)'), { target: { value: '2026-12' } })
    await waitFor(() => expect(getTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ end: '2026-12', offset: 0 }), expect.any(AbortSignal)))
  })

})
