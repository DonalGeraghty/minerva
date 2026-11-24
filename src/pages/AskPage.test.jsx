import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AskPage from './AskPage.jsx'
import * as finance from '../services/finance.js'
import { ApiError } from '../services/request.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'account-one', email: 'owner@example.com' }, logout: vi.fn() } }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('../services/finance.js', async (original) => {
  const module = await original()
  return { ...module, financeChat: vi.fn() }
})

const META = {
  snapshot_id: 'snap1234abcd', rule_set_version: 1, provider: 'openai', model: 'gpt-5',
  fetched_at: '2026-11-24T10:00:00+00:00', stale: false,
  coverage: { first_month: '2026-10', last_month: '2026-11' },
  privacy: 'Answers are computed from a bounded read-only snapshot and are not stored.',
}

async function renderPage() {
  return render(<MemoryRouter><AskPage /></MemoryRouter>)
}

describe('Ask page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => cleanup())

  it('sends a question and renders the answer with the privacy meta line', async () => {
    const user = userEvent.setup()
    finance.financeChat.mockResolvedValue({ status: 'success', answer: 'You spent €312.40 on groceries in November.', meta: META })
    await renderPage()
    await user.type(screen.getByLabelText('Ask a finance question'), 'Groceries in November?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('You spent €312.40 on groceries in November.')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText(/rule set v1/)).toBeInTheDocument()
    expect(screen.getByText(META.privacy)).toBeInTheDocument()
    expect(finance.financeChat).toHaveBeenCalledWith('Groceries in November?', [], expect.any(AbortSignal))
  })

  it('sends prior messages as history on the next question', async () => {
    const user = userEvent.setup()
    finance.financeChat.mockResolvedValueOnce({ status: 'success', answer: 'First answer.', meta: META })
    finance.financeChat.mockResolvedValueOnce({ status: 'success', answer: 'Second answer.', meta: META })
    await renderPage()
    await user.type(screen.getByLabelText('Ask a finance question'), 'First question')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await screen.findByText('First answer.')
    await user.type(screen.getByLabelText('Ask a finance question'), 'Second question')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await screen.findByText('Second answer.')
    expect(finance.financeChat).toHaveBeenLastCalledWith('Second question', [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer.' },
    ], expect.any(AbortSignal))
  })

  it('shows a sync link when the backend says sync_required', async () => {
    const user = userEvent.setup()
    finance.financeChat.mockRejectedValue(new ApiError('Sync the ledger first (POST /api/finance/sync).', 409, 'sync_required'))
    await renderPage()
    await user.type(screen.getByLabelText('Ask a finance question'), 'How much did I spend?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Sync the ledger first')
    expect(alert.querySelector('a')).toHaveAttribute('href', '/')
  })

  it('shows account links for provider_key_required and finance_not_connected', async () => {
    const user = userEvent.setup()
    finance.financeChat.mockRejectedValueOnce(new ApiError('Connect your selected AI provider in Account to ask finance questions.', 409, 'provider_key_required'))
    await renderPage()
    await user.type(screen.getByLabelText('Ask a finance question'), 'Hi')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    let alert = await screen.findByRole('alert')
    expect(alert.querySelector('a')).toHaveAttribute('href', '/account')
    finance.financeChat.mockRejectedValueOnce(new ApiError('Connect your own Google Sheets workbook first.', 403, 'finance_not_connected'))
    await user.clear(screen.getByLabelText('Ask a finance question'))
    await user.type(screen.getByLabelText('Ask a finance question'), 'Again')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await waitFor(() => expect(screen.getByRole('alert').querySelector('a')).toHaveAttribute('href', '/account'))
  })

  it('keeps the user message when the request fails', async () => {
    const user = userEvent.setup()
    finance.financeChat.mockRejectedValue(new ApiError('Could not answer. Try again shortly.', 502, 'provider_unavailable'))
    await renderPage()
    await user.type(screen.getByLabelText('Ask a finance question'), 'What is my net worth?')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await screen.findByRole('alert')
    expect(screen.getByText('What is my net worth?')).toBeInTheDocument()
  })
})
