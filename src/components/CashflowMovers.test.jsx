import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CashflowMovers from './CashflowMovers.jsx'
import TransactionsPage from '../pages/TransactionsPage.jsx'
import { getTransactions } from '../services/finance.js'

vi.mock('../services/finance.js', async (original) => ({ ...await original(), getTransactions: vi.fn() }))

it('lets a category selection open the ledger for that category and comparison month', async () => {
  const user = userEvent.setup()
  getTransactions.mockResolvedValue({ meta: { coverage: { months: ['2020-07'] } }, total: 0, transactions: [] })
  const flow = [{ month: '2020-06', net: '100' }, { month: '2020-07', net: '-310' }]
  const categories = [{ month: '2020-06', categories: { Income: '500', Food: '-100', Rent: '-300' } }, { month: '2020-07', categories: { Income: '500', Food: '-200', Rent: '-300', Travel: '-300', Uncategorised: '-10' } }]
  render(<MemoryRouter><Routes><Route path="/" element={<CashflowMovers flow={flow} categories={categories} />} /><Route path="/transactions" element={<TransactionsPage />} /></Routes></MemoryRouter>)
  expect(screen.getByRole('img', { name: 'Category changes in monthly net cash flow' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Uncategorised:.*change in net cash flow/ }))
  expect(screen.getByRole('link', { name: 'Review whole month ↗' })).toHaveAttribute('href', '/transactions?start=2020-07&end=2020-07')
  await user.click(screen.getByRole('button', { name: /Food:.*change in net cash flow/ }))
  const review = screen.getByRole('link', { name: 'Review Food entries ↗' })
  expect(review).toHaveAttribute('href', '/transactions?start=2020-07&end=2020-07&category=Food')
  await user.click(review)
  await waitFor(() => expect(getTransactions).toHaveBeenCalledWith(expect.objectContaining({ period: 'custom', start: '2020-07', end: '2020-07', category: 'Food', offset: 0 }), expect.any(AbortSignal)))
})
