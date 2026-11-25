import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AskPage from './AskPage.jsx'
import * as finance from '../services/finance.js'
import { ApiError } from '../services/request.js'

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

  it('discloses provider sharing before chatting and sends subsequent questions with history', async () => {
    const user = userEvent.setup()
    finance.financeChat.mockResolvedValueOnce({ status: 'success', answer: 'First answer.', meta: META })
    finance.financeChat.mockResolvedValueOnce({ status: 'success', answer: 'Second answer.', meta: META })
    await renderPage()
    const notice = screen.getByText(/Your question and financial data.*selected AI provider/)
    expect(notice).toBeVisible()
    expect(screen.getByLabelText('Ask a finance question')).toHaveAccessibleDescription(notice.textContent)
    expect(finance.financeChat).not.toHaveBeenCalled()
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
    expect(screen.getByText('How much did I spend?')).toBeInTheDocument()
    expect(alert).toHaveTextContent('Sync the ledger first')
    expect(alert.querySelector('a')).toHaveAttribute('href', '/account')
    expect(alert.querySelector('a')).toHaveTextContent('Import your ledger in Account')
  })

})
