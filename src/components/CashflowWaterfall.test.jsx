import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CashflowWaterfall from './CashflowWaterfall.jsx'
import TransactionsPage from '../pages/TransactionsPage.jsx'
import { getTransactions } from '../services/finance.js'

vi.mock('../services/finance.js', async (original) => ({ ...await original(), getTransactions: vi.fn() }))
const flow = [{ month: '2026-10', net: '-100.00' }, { month: '2026-11', net: '300.00' }]
beforeEach(() => {
  getTransactions.mockReset().mockResolvedValue({
    meta: { snapshot_id: 'snapshot', rule_set_version: 1, coverage: { months: ['2026-10', '2026-11'] } },
    total: 0, transactions: [],
  })
})
afterEach(cleanup)

function renderChart(period = { start: '2026-10', end: '2026-11' }) {
  return render(<MemoryRouter><Routes>
    <Route path="/" element={<CashflowWaterfall data={flow} total="200.00" period={period} />} />
    <Route path="/transactions" element={<TransactionsPage />} />
  </Routes></MemoryRouter>)
}

it.each(['2026-10', '2026-11'])('opens the Ledger for month %s with its filters applied', async (month) => {
  const user = userEvent.setup()
  renderChart()
  const link = screen.getAllByRole('link').find((item) => item.getAttribute('href') === `/transactions?start=${month}&end=${month}`)
  await user.click(link)
  await screen.findByRole('heading', { name: 'Ledger.' })
  expect(screen.getByLabelText('From (YYYY-MM)')).toHaveValue(month)
  expect(screen.getByLabelText('To (YYYY-MM)')).toHaveValue(month)
  await waitFor(() => expect(getTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ period: 'custom', start: month, end: month, offset: 0 }), expect.any(AbortSignal)))
})

it('opens the total for the entire selected period', async () => {
  const user = userEvent.setup()
  renderChart()
  await user.click(screen.getByRole('link', { name: /View selected period transactions/ }))
  await waitFor(() => expect(getTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ period: 'custom', start: '2026-10', end: '2026-11' }), expect.any(AbortSignal)))
})

it('opens an unbounded total in the all-time Ledger', async () => {
  const user = userEvent.setup()
  renderChart({ start: null, end: null })
  await user.click(screen.getByRole('link', { name: /View selected period transactions/ }))
  await waitFor(() => expect(getTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ period: 'all', start: '', end: '' }), expect.any(AbortSignal)))
})
