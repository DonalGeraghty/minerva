import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import BudgetPage from './BudgetPage.jsx'
import { TabSessionProvider } from '../context/TabSessionContext.jsx'
import { createBudgetPlan, getBudgetContext } from '../services/finance.js'
import { budgetContext, budgetMeta, budgetResult } from '../test/budgetFixture.js'

vi.mock('../services/finance.js', async (original) => ({ ...await original(), getBudgetContext: vi.fn(), createBudgetPlan: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  getBudgetContext.mockResolvedValue({ context: structuredClone(budgetContext), meta: { ...budgetMeta } })
  createBudgetPlan.mockResolvedValue(budgetResult())
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function open() {
  return render(<MemoryRouter><TabSessionProvider><nav><Link to="/">Budget tab</Link><Link to="/other">Other tab</Link></nav><Routes><Route path="/" element={<BudgetPage />} /><Route path="/other" element={<p>Another tab</p>} /></Routes></TabSessionProvider></MemoryRouter>)
}
async function generate(user) {
  await user.click(await screen.findByRole('button', { name: 'Plan the rest of this month' }))
  await screen.findByRole('button', { name: 'Update plan' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Update plan' })).toBeEnabled())
}

it('generates all approaches once, switches instantly and lets a limit be edited', async () => {
  const user = userEvent.setup()
  open()
  await generate(user)
  expect(screen.getByRole('img', { name: /^Groceries:/ })).toHaveAccessibleName(/€500.00 limit/)
  await user.click(screen.getByRole('button', { name: /^Save more/ }))
  expect(screen.getByRole('img', { name: /^Groceries:/ })).toHaveAccessibleName(/€400.00 limit/)
  expect(createBudgetPlan).toHaveBeenCalledTimes(1)
  const input = screen.getByLabelText('Monthly limit for Groceries')
  fireEvent.change(input, { target: { value: '450.00' } })
  expect(screen.getByRole('img', { name: /^Groceries:/ })).toHaveAccessibleName(/€450.00 limit/)
  await user.click(screen.getByRole('link', { name: 'Other tab' }))
  await user.click(screen.getByRole('link', { name: 'Budget tab' }))
  expect(await screen.findByLabelText('Monthly limit for Groceries')).toHaveValue('450.00')
  expect(screen.getByRole('button', { name: /^Save more/ })).toHaveAttribute('aria-pressed', 'true')
})

it('refreshes actual spending while holding the chosen limit steady', async () => {
  const user = userEvent.setup()
  open()
  await generate(user)
  const updated = structuredClone(budgetContext)
  updated.actual.spent_eur = '1250.00'
  updated.current_categories[0].spent_eur = '250.00'
  getBudgetContext.mockResolvedValue({ context: updated, meta: { ...budgetMeta, snapshot_id: 'new' } })
  await user.click(screen.getByRole('button', { name: 'Refresh actual spending' }))
  await waitFor(() => expect(screen.getByRole('img', { name: /^Groceries:/ })).toHaveAccessibleName(/€250.00 spent, €500.00 limit, €250.00 left/))
  expect(createBudgetPlan).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/Actuals have updated; your limits have stayed fixed/)).toBeInTheDocument()
})

it('sends user context and corrected payment status then explains a reassessment', async () => {
  const user = userEvent.setup()
  open()
  await generate(user)
  await user.type(screen.getByLabelText('Anything coming up?'), 'Gifts are already bought')
  const card = screen.getByDisplayValue('Bonus').closest('article')
  await user.selectOptions(within(card).getByLabelText('Status'), 'paid')
  const next = budgetResult()
  next.plan.plan_id = 'plan-two'
  next.plan.approaches.balanced.categories[0].limit_eur = '450.00'
  createBudgetPlan.mockResolvedValue(next)
  await user.click(screen.getByRole('button', { name: 'Update plan' }))
  await waitFor(() => expect(createBudgetPlan).toHaveBeenLastCalledWith(expect.objectContaining({ notes: 'Gifts are already bought', corrections: [expect.objectContaining({ id: 'salary', status: 'paid', basis: 'user' })] }), expect.any(AbortSignal)))
  expect(await screen.findByText(/Groceries: reduced by €50.00/)).toBeInTheDocument()
})

it('finishes a plan in the background and retains the old plan if the next assessment fails', async () => {
  let resolve
  createBudgetPlan.mockReturnValueOnce(new Promise((done) => { resolve = done }))
  const user = userEvent.setup()
  open()
  await user.click(await screen.findByRole('button', { name: 'Plan the rest of this month' }))
  await user.click(screen.getByRole('link', { name: 'Other tab' }))
  await act(async () => resolve(budgetResult()))
  await user.click(screen.getByRole('link', { name: 'Budget tab' }))
  await screen.findByLabelText('Monthly limit for Groceries')
  createBudgetPlan.mockRejectedValue(new Error('Provider unavailable'))
  await user.click(screen.getByRole('button', { name: 'Update plan' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable')
  expect(screen.getByRole('img', { name: /^Groceries:/ })).toHaveAccessibleName(/€500.00 limit/)
})

it('requires an import before reassessing stale data', async () => {
  getBudgetContext.mockResolvedValue({ context: budgetContext, meta: { ...budgetMeta, stale: true } })
  open()
  expect(await screen.findByRole('button', { name: 'Plan the rest of this month' })).toBeDisabled()
  expect(createBudgetPlan).not.toHaveBeenCalled()
})

it('cancels a pending assessment when the account session closes', async () => {
  let resolve
  createBudgetPlan.mockReturnValueOnce(new Promise((done) => { resolve = done }))
  const user = userEvent.setup()
  const view = open()
  await user.click(await screen.findByRole('button', { name: 'Plan the rest of this month' }))
  const signal = createBudgetPlan.mock.calls[0][1]
  view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => resolve(budgetResult()))
  open()
  expect(await screen.findByRole('button', { name: 'Plan the rest of this month' })).toBeInTheDocument()
})
