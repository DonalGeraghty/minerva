import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App.jsx'
import * as finance from './services/finance.js'
import * as rulesApi from './services/financeRules.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'one' }, loading: false } }))
vi.mock('./context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('./pages/AccountPage.jsx', () => ({ default: () => <p>Account settings</p> }))
vi.mock('./services/finance.js', async (original) => ({ ...await original(), financeChat: vi.fn(), getSummary: vi.fn(), getCashflow: vi.fn(), getSyncStatus: vi.fn(), getCashflowBreakdown: vi.fn(), getTransactions: vi.fn() }))
vi.mock('./services/financeRules.js', async (original) => ({ ...await original(), listFinanceRules: vi.fn(), updateFinanceRule: vi.fn(), previewRulesImport: vi.fn(), commitRulesImport: vi.fn() }))
const META = { snapshot_id: 'snapshot-one', rule_set_version: 1, fetched_at: '2026-11-25T10:00:00Z', provider: 'openai', model: 'example', coverage: { months: ['2026-10', '2026-11'] }, warnings: [] }
const RULE = { rule_id: 'A1', name: 'Food', revision: 1, scope: 'janus', type: 'accounting', field: 'merchant', operator: 'equals', value: 'Shop', action: 'exclude', action_value: '', priority: 100, status: 'active' }
const nav = (label) => within(screen.getByRole('navigation', { name: 'Primary navigation' })).getByRole('link', { name: label })
function open(path = '/ask') { window.history.replaceState({}, '', path); return render(<App />) }
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }
beforeEach(() => {
  vi.resetAllMocks()
  auth.user = { accountId: 'one' }
  vi.spyOn(window, 'scrollTo').mockImplementation((_x, y) => { Object.defineProperty(window, 'scrollY', { configurable: true, value: y }) })
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  finance.financeChat.mockResolvedValue({ answer: 'Saved answer', meta: META })
  finance.getSummary.mockResolvedValue({ meta: META, summary: { adjusted_totals: { net: '200.00' }, period: { start: '2026-10', end: '2026-11' }, gaps: [] } })
  finance.getCashflow.mockResolvedValue({ meta: META, cashflow: [{ month: '2026-10', net: '-100.00' }, { month: '2026-11', net: '300.00' }] })
  finance.getSyncStatus.mockResolvedValue({ sync: { snapshot_id: META.snapshot_id } })
  finance.getCashflowBreakdown.mockResolvedValue({ meta: META, cashflow: [{ month: '2026-10', items: [{ type: 'Expense', category: 'Food', amount_eur: '-100.00' }] }] })
  finance.getTransactions.mockImplementation(async ({ offset }) => ({ meta: META, total: 100, transactions: [{ row: offset, transaction_id: `T-${offset}`, description: 'Payment', derived: {} }] }))
  rulesApi.listFinanceRules.mockResolvedValue({ rules: [RULE], rule_set_version: 1 })
  rulesApi.updateFinanceRule.mockResolvedValue({})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('retains a conversation and unfinished question across tab changes', async () => {
  const user = userEvent.setup()
  open()
  await user.type(screen.getByLabelText('Ask a finance question'), 'First question')
  await user.click(screen.getByRole('button', { name: 'Ask' }))
  await screen.findByText('Saved answer')
  await user.type(screen.getByLabelText('Ask a finance question'), 'Draft question')
  await user.click(nav('Dashboard'))
  await screen.findByRole('group', { name: 'Monthly net cash flow waterfall' })
  await user.click(nav('Ask'))
  expect(screen.getByText('First question')).toBeInTheDocument()
  expect(screen.getByText('Saved answer')).toBeInTheDocument()
  expect(screen.getByLabelText('Ask a finance question')).toHaveValue('Draft question')
  await user.click(screen.getByRole('button', { name: 'Ask' }))
  await waitFor(() => expect(finance.financeChat).toHaveBeenLastCalledWith('Draft question', [{ role: 'user', content: 'First question' }, { role: 'assistant', content: 'Saved answer' }], expect.any(AbortSignal)))
})

it('finishes an answer while away, without sending a duplicate request', async () => {
  const pending = deferred()
  finance.financeChat.mockReturnValueOnce(pending.promise)
  const user = userEvent.setup()
  open()
  await user.type(screen.getByLabelText('Ask a finance question'), 'Question')
  await user.click(screen.getByRole('button', { name: 'Ask' }))
  await user.click(nav('Ledger'))
  await act(async () => pending.resolve({ answer: 'Background answer', meta: META }))
  await user.click(nav('Ask'))
  expect(screen.getByText('Background answer')).toBeInTheDocument()
  expect(finance.financeChat).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
})

it('retains pending and failed Ask status when returning to the tab', async () => {
  const pending = deferred()
  finance.financeChat.mockReturnValueOnce(pending.promise)
  const user = userEvent.setup()
  open()
  await user.type(screen.getByLabelText('Ask a finance question'), 'Pending question')
  await user.click(screen.getByRole('button', { name: 'Ask' }))
  await user.click(nav('Account'))
  await user.click(nav('Ask'))
  expect(screen.getByText('Thinking…')).toBeInTheDocument()
  expect(screen.getByLabelText('Ask a finance question')).toBeDisabled()
  expect(finance.financeChat).toHaveBeenCalledTimes(1)
  await act(async () => pending.resolve(Promise.reject(new Error('Provider unavailable'))))
  expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable')
  await user.click(nav('Account'))
  await user.click(nav('Ask'))
  expect(screen.getByRole('alert')).toHaveTextContent('Provider unavailable')
  expect(screen.getByText('Pending question')).toBeInTheDocument()
})

it('aborts and ignores a cleared conversation’s late answer', async () => {
  const pending = deferred()
  finance.financeChat.mockReturnValueOnce(pending.promise)
  const user = userEvent.setup()
  open()
  await user.type(screen.getByLabelText('Ask a finance question'), 'Old question')
  await user.click(screen.getByRole('button', { name: 'Ask' }))
  const signal = finance.financeChat.mock.calls[0][2]
  await user.click(screen.getByRole('button', { name: 'New conversation' }))
  expect(signal.aborted).toBe(true)
  await act(async () => pending.resolve({ answer: 'Old answer', meta: META }))
  expect(screen.queryByText('Old answer')).not.toBeInTheDocument()
  expect(screen.queryByText('Old question')).not.toBeInTheDocument()
})

it.each(['change account', 'sign out'])('clears state and pending requests on %s', async (action) => {
  const pending = deferred()
  finance.financeChat.mockReturnValueOnce(pending.promise)
  const user = userEvent.setup()
  const view = open()
  await user.type(screen.getByLabelText('Ask a finance question'), 'Private question')
  await user.click(screen.getByRole('button', { name: 'Ask' }))
  const signal = finance.financeChat.mock.calls[0][2]
  auth.user = action === 'sign out' ? null : { accountId: 'two' }
  view.rerender(<App />)
  expect(signal.aborted).toBe(true)
  if (!auth.user) { auth.user = { accountId: 'one' }; view.rerender(<App />) }
  await act(async () => pending.resolve({ answer: 'Private answer', meta: META }))
  expect(screen.queryByText('Private question')).not.toBeInTheDocument()
  expect(screen.queryByText('Private answer')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Ask a finance question')).toHaveValue('')
})

it('preserves Ledger filters, sorting and page while fetching current results on return', async () => {
  const user = userEvent.setup()
  open('/transactions')
  await screen.findByText('T-0')
  await user.type(screen.getByLabelText('Merchant'), 'Shop')
  await user.selectOptions(screen.getByLabelText('Sort'), 'amount_eur:asc')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('T-50')
  await user.click(nav('Ask'))
  const count = finance.getTransactions.mock.calls.length
  await user.click(nav('Ledger'))
  await screen.findByText('T-50')
  expect(screen.getByLabelText('Merchant')).toHaveValue('Shop')
  expect(screen.getByLabelText('Sort')).toHaveValue('amount_eur:asc')
  expect(finance.getTransactions.mock.calls.length).toBeGreaterThan(count)
  expect(finance.getTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ merchant: 'Shop', sort: 'amount_eur', order: 'asc', offset: 50 }), expect.any(AbortSignal))
})

it('restores the Dashboard period and category drilldown after navigation', async () => {
  const user = userEvent.setup()
  open('/')
  await screen.findByRole('group', { name: 'Monthly net cash flow waterfall' })
  await user.selectOptions(screen.getByLabelText('Period'), 'custom')
  await screen.findByRole('group', { name: 'Monthly net cash flow waterfall' })
  await user.click(screen.getByRole('button', { name: /^Oct 2026:/ }))
  await screen.findByRole('group', { name: 'Oct 2026 category cash flow waterfall' })
  const chart = screen.getByRole('region', { name: /Cash flow waterfall/ })
  chart.scrollLeft = 100
  fireEvent.scroll(chart)
  await user.click(nav('Ask'))
  await user.click(nav('Dashboard'))
  await screen.findByRole('group', { name: 'Oct 2026 category cash flow waterfall' })
  expect(screen.getByLabelText('Period')).toHaveValue('custom')
  expect(screen.getByLabelText('From (YYYY-MM)')).toHaveValue('2026-10')
  expect(finance.getCashflowBreakdown).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(screen.getByRole('region', { name: /Cash flow waterfall/ }).scrollLeft).toBe(100))
})

it('requires a fresh CSV preview after rules change while away', async () => {
  const preview = { changes: [], held: [], conflicts: [], rule_set_version: 1, would_be_version: 2 }
  rulesApi.previewRulesImport.mockResolvedValueOnce(preview).mockResolvedValueOnce({ ...preview, rule_set_version: 2, would_be_version: 3 })
  const user = userEvent.setup()
  open('/rules')
  await screen.findByText('A1')
  await user.upload(screen.getByLabelText('Import rules CSV file'), new File(['rule_id,scope\nA1,janus'], 'rules.csv', { type: 'text/csv' }))
  await screen.findByRole('button', { name: 'Commit import' })
  await user.click(nav('Ask'))
  rulesApi.listFinanceRules.mockResolvedValue({ rules: [RULE], rule_set_version: 2 })
  await user.click(nav('Rules'))
  await screen.findByText(/The rule set has changed since this preview/)
  expect(screen.getByRole('button', { name: 'Commit import' })).toBeDisabled()
  expect(rulesApi.commitRulesImport).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Review saved CSV again' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Commit import' })).toBeEnabled())
})

it('retains rule drafts and their original revision across newer server data', async () => {
  const user = userEvent.setup()
  open('/rules')
  await screen.findByText('A1')
  await user.type(screen.getByLabelText('Search'), 'Food')
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await user.clear(screen.getByLabelText('Name'))
  await user.type(screen.getByLabelText('Name'), 'My draft')
  // Browser navigation can leave a modal without discarding the edit.
  act(() => { window.history.pushState({}, '', '/ask'); window.dispatchEvent(new PopStateEvent('popstate')) })
  rulesApi.listFinanceRules.mockResolvedValue({ rules: [{ ...RULE, revision: 2 }], rule_set_version: 2 })
  await user.click(nav('Rules'))
  expect(screen.getByLabelText('Name')).toHaveValue('My draft')
  await screen.findByText(/revision 2/)
  await user.click(screen.getByRole('button', { name: 'Save rule' }))
  await waitFor(() => expect(rulesApi.updateFinanceRule).toHaveBeenCalledWith('A1', expect.objectContaining({ name: 'My draft', revision: 1 })))
  expect(screen.getByLabelText('Search')).toHaveValue('Food')
})

it('restores the saved page and inner scroll positions', async () => {
  const user = userEvent.setup()
  open('/transactions')
  await screen.findByText('T-0')
  await waitFor(() => expect(screen.getByRole('region', { name: /Ledger transactions/ })).toBeInTheDocument())
  await act(() => new Promise(requestAnimationFrame))
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 250 })
  const table = screen.getByRole('region', { name: /Ledger transactions/ })
  table.scrollLeft = 90
  fireEvent.scroll(table)
  await user.click(nav('Ask'))
  await waitFor(() => expect(window.scrollY).toBe(0))
  await user.click(nav('Ledger'))
  await screen.findByText('T-0')
  await waitFor(() => expect(window.scrollY).toBe(250))
  expect(screen.getByRole('region', { name: /Ledger transactions/ }).scrollLeft).toBe(90)
})
