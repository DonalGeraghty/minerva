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
vi.mock('../components/GarminConnectionSettings.jsx', () => ({ default: () => <div>Garmin settings</div> }))

describe('Garmin account settings', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('keeps Garmin and shared AI controls without flashcard context settings', () => {
    render(<MemoryRouter><AccountPage /></MemoryRouter>)
    expect(screen.getByText('Garmin settings')).toBeInTheDocument()
    expect(screen.getByText('AI settings')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /existing cards/i })).not.toBeInTheDocument()
  })

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
