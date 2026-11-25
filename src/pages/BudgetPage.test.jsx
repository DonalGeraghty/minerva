import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import BudgetPage from './BudgetPage.jsx'
import { TabSessionProvider } from '../context/TabSessionContext.jsx'
import { createBudgetPlan, getBudgetContext } from '../services/finance.js'
import { budgetContext, budgetMeta, budgetResult } from '../test/budgetFixture.js'
import { ApiError } from '../services/request.js'

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
  await user.click(await screen.findByRole('button', { name: /Update with AI/ }))
  await screen.findByRole('heading', { name: /€3,320.00 left this month/ })
  await waitFor(() => expect(screen.getByRole('button', { name: /Update with AI/ })).toBeEnabled())
}

it('generates once, switches limits and retains the mode and category across tabs', async () => {
  const user = userEvent.setup()
  open()
  await generate(user)
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByLabelText('AI assessment for Balanced')).toHaveTextContent('Leave moderate room for groceries')
  expect(screen.getByRole('button', { name: /^Groceries:/ })).toHaveAccessibleName(/€500.00 limit/)
  await user.click(screen.getByRole('button', { name: 'Save more' }))
  expect(screen.getByRole('button', { name: /^Groceries:/ })).toHaveAccessibleName(/€400.00 limit/)
  expect(screen.getByLabelText('AI assessment for Save more')).toHaveTextContent('Keep flexible spending tight')
  await user.click(screen.getByRole('button', { name: 'More flexibility' }))
  expect(screen.getByLabelText('AI assessment for More flexibility')).toHaveTextContent('Allow more flexibility in groceries')
  await user.click(screen.getByRole('button', { name: 'Save more' }))
  expect(createBudgetPlan).toHaveBeenCalledTimes(1)
  expect(createBudgetPlan).toHaveBeenCalledWith(expect.any(AbortSignal))
  await user.click(screen.getByRole('button', { name: /^Groceries:/ }))
  expect(screen.getByRole('region', { name: 'Groceries breakdown' })).toHaveTextContent('Market')
  await user.click(screen.getByRole('link', { name: 'Other tab' }))
  await user.click(screen.getByRole('link', { name: 'Budget tab' }))
  expect(await screen.findByRole('region', { name: 'Groceries breakdown' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save more' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('AI assessment for Save more')).toHaveTextContent('Keep flexible spending tight')
})

it('refreshes actual spending on return while holding limits steady', async () => {
  const user = userEvent.setup()
  open()
  await generate(user)
  const updated = structuredClone(budgetContext)
  updated.actual.spent_eur = '1250.00'
  updated.current_categories[0].spent_eur = '250.00'
  getBudgetContext.mockResolvedValue({ context: updated, meta: { ...budgetMeta, fetched_at: '2026-11-25T12:00:00Z', snapshot_id: 'new' } })
  await user.click(screen.getByRole('link', { name: 'Other tab' }))
  await user.click(screen.getByRole('link', { name: 'Budget tab' }))
  await waitFor(() => expect(screen.getByRole('button', { name: /^Groceries:/ })).toHaveAccessibleName(/€250.00 spent, €500.00 limit, €250.00 left/))
  expect(createBudgetPlan).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/Spending has updated/)).toBeInTheDocument()
})

it('opens category reasoning and bills with the keyboard, then restores focus on Escape', async () => {
  const user = userEvent.setup()
  open()
  await generate(user)
  const bar = screen.getByRole('button', { name: /^Housing:/ })
  bar.focus()
  await user.keyboard('{Enter}')
  const panel = screen.getByRole('region', { name: 'Housing breakdown' })
  expect(panel).toHaveFocus()
  expect(panel).toHaveTextContent('The bill still needs to be paid.')
  expect(panel).toHaveTextContent('Expected housing bill')
  await user.keyboard('{Escape}')
  expect(panel).not.toBeInTheDocument()
  expect(bar).toHaveFocus()
})

it('finishes in the background and retains the last chart if reassessment fails', async () => {
  let resolve
  createBudgetPlan.mockReturnValueOnce(new Promise((done) => { resolve = done }))
  const user = userEvent.setup()
  open()
  await user.click(await screen.findByRole('button', { name: /Update with AI/ }))
  await user.click(screen.getByRole('link', { name: 'Other tab' }))
  await act(async () => resolve(budgetResult()))
  await user.click(screen.getByRole('link', { name: 'Budget tab' }))
  await screen.findByRole('heading', { name: /€3,320.00 left this month/ })
  createBudgetPlan.mockRejectedValue(new Error('Provider unavailable'))
  await user.click(screen.getByRole('button', { name: /Update with AI/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable')
  expect(screen.getByRole('button', { name: /^Groceries:/ })).toHaveAccessibleName(/€500.00 limit/)
})

it('uses the assessment evidence when the initial context fetch is older', async () => {
  const next = budgetResult()
  next.context.current_categories[0].spent_eur = '300.00'
  next.context.actual.spent_eur = '1300.00'
  next.meta.fetched_at = '2026-11-25T12:00:00Z'
  createBudgetPlan.mockResolvedValue(next)
  const user = userEvent.setup()
  open()
  await user.click(await screen.findByRole('button', { name: /Update with AI/ }))
  expect(await screen.findByRole('button', { name: /^Groceries:/ })).toHaveAccessibleName(/€300.00 spent/)
})

it('requires a successful import before assessing stale data', async () => {
  getBudgetContext.mockResolvedValue({ context: budgetContext, meta: { ...budgetMeta, stale: true } })
  open()
  expect(await screen.findByRole('button', { name: /Update with AI/ })).toBeDisabled()
  expect(createBudgetPlan).not.toHaveBeenCalled()
})

it('respects a failed import on return even when its last-success date matches the plan', async () => {
  const user = userEvent.setup()
  open()
  await generate(user)
  getBudgetContext.mockResolvedValue({ context: budgetContext, meta: { ...budgetMeta, stale: true } })
  await user.click(screen.getByRole('link', { name: 'Other tab' }))
  await user.click(screen.getByRole('link', { name: 'Budget tab' }))
  await waitFor(() => expect(screen.getByRole('button', { name: /Update with AI/ })).toBeDisabled())
  expect(screen.getByRole('button', { name: /^Groceries:/ })).toHaveAccessibleName(/€500.00 limit/)
})

it('explains failed proposals without incorrectly linking to Account', async () => {
  createBudgetPlan.mockRejectedValue(new ApiError('The proposal still needs correction.', 422, 'budget_invalid_proposal', { validation_reason: 'An expected bill was not covered.' }))
  const user = userEvent.setup()
  open()
  await user.click(await screen.findByRole('button', { name: /Update with AI/ }))
  const alert = await screen.findByRole('alert')
  expect(within(alert).queryByRole('link', { name: /Check Account/ })).not.toBeInTheDocument()
  await user.click(screen.getByText('What prevented this plan'))
  expect(screen.getByText('An expected bill was not covered.')).toBeVisible()
})

it('cancels a pending assessment when the account session closes', async () => {
  let resolve
  createBudgetPlan.mockReturnValueOnce(new Promise((done) => { resolve = done }))
  const user = userEvent.setup()
  const view = open()
  await user.click(await screen.findByRole('button', { name: /Update with AI/ }))
  const signal = createBudgetPlan.mock.calls[0][0]
  view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => resolve(budgetResult()))
  open()
  await waitFor(() => expect(screen.getByRole('button', { name: /Update with AI/ })).toBeEnabled())
  expect(screen.queryByRole('heading', { name: /left this month/ })).not.toBeInTheDocument()
})
