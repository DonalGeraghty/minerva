import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'account-one' }, logout: vi.fn() } }))
vi.mock('./context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('./pages/DashboardPage.jsx', () => ({ default: () => <div>Dashboard page</div> }))
vi.mock('./pages/TransactionsPage.jsx', () => ({ default: () => <div>Ledger page</div> }))
vi.mock('./pages/RulesPage.jsx', () => ({ default: () => <div>Rules page</div> }))
vi.mock('./pages/AskPage.jsx', () => ({ default: () => <div>Ask page</div> }))
vi.mock('./pages/AccountPage.jsx', () => ({ default: () => <div>Account settings</div> }))
vi.mock('./pages/InstructionsPage.jsx', () => ({ default: () => <div>Instructions guide</div> }))

function open(path = '/') { window.history.replaceState({}, '', path); return render(<App />) }
function navigation() { return within(screen.getByRole('navigation', { name: 'Primary navigation' })) }
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  auth.user = { accountId: 'account-one' }
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Minerva navigation', () => {
  it('shows all six dock links and opens each section directly', async () => {
    const user = userEvent.setup()
    open('/')
    expect(navigation().getAllByRole('link')).toHaveLength(6)
    for (const [label, text] of [['Ledger', 'Ledger page'], ['Rules', 'Rules page'], ['Ask', 'Ask page'], ['Account', 'Account settings'], ['Instructions', 'Instructions guide']]) {
      await user.click(navigation().getByRole('link', { name: label }))
      expect(await screen.findByText(text)).toBeInTheDocument()
      expect(navigation().getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
    }
  })

  it('shows the login screen when signed out', () => {
    auth.user = null
    auth.loading = false
    open('/')
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
