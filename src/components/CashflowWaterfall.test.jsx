import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CashflowWaterfall from './CashflowWaterfall.jsx'
import { getCashflowBreakdown } from '../services/finance.js'

vi.mock('../services/finance.js', () => ({ getCashflowBreakdown: vi.fn() }))
const meta = { snapshot_id: 'snapshot', rule_set_version: 3 }
const flow = [{ month: '2026-10', net: '-100.00' }, { month: '2026-11', net: '300.00' }]
const items = [
  { type: 'Income', category: 'Salary', amount_eur: '1000.00' },
  { type: 'Expense', category: 'Groceries', amount_eur: '-800.00' },
  { type: 'Expense', category: 'Housing', amount_eur: '-350.00' },
  { type: 'Refund', category: 'Groceries', amount_eur: '50.00' },
]
const response = { meta, cashflow: [{ month: '2026-10', items }] }
beforeEach(() => getCashflowBreakdown.mockReset().mockResolvedValue(response))
afterEach(cleanup)
function renderChart() { return render(<CashflowWaterfall data={flow} total="200.00" meta={meta} />) }
const monthButton = () => screen.getByRole('button', { name: /^Oct 2026:/ })

it('replaces the monthly chart with categories and restores months, focus and scroll on Back', async () => {
  const user = userEvent.setup()
  renderChart()
  screen.getByRole('region').scrollLeft = 75
  await user.click(monthButton())
  expect(await screen.findByRole('group', { name: 'Oct 2026 category cash flow waterfall' })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Monthly net cash flow waterfall' })).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: /^Expense · Groceries:/ })).toHaveAccessibleName(/-€800/)
  expect(screen.getByRole('img', { name: /^Refund · Groceries:/ })).toHaveAccessibleName(/€50/)
  expect(screen.getByRole('img', { name: /^Net total:/ })).toHaveAccessibleName(/-€100/)
  expect(getCashflowBreakdown).toHaveBeenCalledWith('2026-10', expect.any(AbortSignal))
  await user.click(screen.getByRole('button', { name: /Back to months/ }))
  expect(screen.getByRole('group', { name: 'Monthly net cash flow waterfall' })).toBeInTheDocument()
  await waitFor(() => expect(monthButton()).toHaveFocus())
  expect(screen.getByRole('region').scrollLeft).toBe(75)
})

it.each(['Enter', ' '])('supports keyboard activation with %s', async (key) => {
  renderChart()
  fireEvent.keyDown(monthButton(), { key })
  await screen.findByRole('heading', { name: 'Oct 2026 breakdown' })
  expect(screen.getByRole('button', { name: /Back to months/ })).toHaveFocus()
  await screen.findByRole('group', { name: 'Oct 2026 category cash flow waterfall' })
})

it('keeps totals and categories informational', async () => {
  const user = userEvent.setup()
  renderChart()
  await user.click(screen.getByRole('img', { name: /^Net total:/ }))
  expect(getCashflowBreakdown).not.toHaveBeenCalled()
  await user.click(monthButton())
  await screen.findByRole('group', { name: 'Oct 2026 category cash flow waterfall' })
  expect(screen.getAllByRole('button')).toHaveLength(1)
})

it.each([
  { ...response, meta: { ...meta, snapshot_id: 'other' } },
  { ...response, meta: { ...meta, rule_set_version: 4 } },
  { ...response, cashflow: [{ month: '2026-10', items: items.slice(0, 2) }] },
  { ...response, cashflow: [] },
])('rejects inconsistent or missing category data', async (value) => {
  getCashflowBreakdown.mockResolvedValue(value)
  const user = userEvent.setup()
  renderChart()
  await user.click(monthButton())
  await screen.findByRole('alert')
  expect(screen.queryByRole('group', { name: /category cash flow waterfall/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Back to months/ }))
  expect(monthButton()).toBeInTheDocument()
})

it('allows retry after a failed request', async () => {
  getCashflowBreakdown.mockRejectedValueOnce(new Error('Connection interrupted'))
  const user = userEvent.setup()
  renderChart()
  await user.click(monthButton())
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted')
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('group', { name: 'Oct 2026 category cash flow waterfall' })
})

it('ignores a response arriving after Back', async () => {
  let resolve
  getCashflowBreakdown.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
  const user = userEvent.setup()
  renderChart()
  await user.click(monthButton())
  const signal = getCashflowBreakdown.mock.calls[0][1]
  await user.click(screen.getByRole('button', { name: /Back to months/ }))
  expect(signal.aborted).toBe(true)
  resolve(response)
  await waitFor(() => expect(monthButton()).toBeInTheDocument())
  expect(screen.queryByRole('heading', { name: 'Oct 2026 breakdown' })).not.toBeInTheDocument()
})
