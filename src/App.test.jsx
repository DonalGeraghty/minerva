import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'account-one' }, logout: vi.fn() } }))
vi.mock('./context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('./pages/RulesPage.jsx', () => ({ default: () => <div>Rules page</div> }))
vi.mock('./pages/AccountPage.jsx', () => ({ default: () => <div>Account settings</div> }))

function open(path = '/') { window.history.replaceState({}, '', path); return render(<App />) }
function navigation() { return within(screen.getByRole('navigation', { name: 'Primary navigation' })) }
beforeEach(() => {
  vi.resetAllMocks()
  auth.user = { accountId: 'account-one' }
})
afterEach(cleanup)

describe('Minerva navigation', () => {
  it('redirects / and unknown paths to the Rules page', () => {
    for (const path of ['/', '/activities', '/anything-else']) {
      cleanup()
      open(path)
      expect(screen.getByText('Rules page')).toBeInTheDocument()
      expect(window.location.pathname).toBe('/rules')
      expect(navigation().getByRole('link', { name: 'Rules' })).toHaveAttribute('aria-current', 'page')
    }
  })

  it('shows exactly the Rules and Account dock links and opens Account directly', async () => {
    const user = userEvent.setup()
    open('/rules')
    expect(screen.getByText('Rules page')).toBeInTheDocument()
    expect(navigation().getAllByRole('link')).toHaveLength(2)
    await user.click(navigation().getByRole('link', { name: 'Account' }))
    expect(screen.getByText('Account settings')).toBeInTheDocument()
    expect(navigation().getByRole('link', { name: 'Account' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the login screen when signed out', () => {
    auth.user = null
    auth.loading = false
    open('/rules')
    expect(screen.queryByText('Rules page')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })
})
