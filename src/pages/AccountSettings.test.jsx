import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountPage from './AccountPage.jsx'

const { deleteAccount } = vi.hoisted(() => ({ deleteAccount: vi.fn() }))
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({
  user: { email: 'user@example.com', accountId: 'account-1' }, deleteAccount,
}) }))
vi.mock('../components/AISettings.jsx', () => ({ default: () => <div>AI settings</div> }))
vi.mock('../components/FinanceConnectionSettings.jsx', () => ({ default: () => <div>Finance settings</div> }))

describe('Account settings', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('still requires a password and shared-account confirmation before deletion', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteAccount.mockResolvedValue(undefined)
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    await user.type(screen.getByLabelText('Confirm with your password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith('password123'))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Minerva, Nyx, and Aether'))
  })
})
