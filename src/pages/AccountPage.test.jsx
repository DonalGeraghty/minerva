import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountPage from './AccountPage.jsx'
import { getMinervaSettings, saveMinervaSettings } from '../services/minervaSettings.js'

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }))

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { email: 'user@example.com', accountId: 'account-1' },
    logout: logoutMock,
    deleteAccount: vi.fn(),
  }),
}))
vi.mock('../components/AISettings.jsx', () => ({ default: () => <div>AI settings</div> }))
vi.mock('../services/minervaSettings.js', () => ({
  getMinervaSettings: vi.fn(),
  saveMinervaSettings: vi.fn(),
}))

describe('Minerva account settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMinervaSettings.mockResolvedValue({ include_card_context: false })
    saveMinervaSettings.mockResolvedValue({ include_card_context: true })
  })

  afterEach(() => cleanup())

  it('lets the user enable their full card library as Minerva context', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AccountPage /></MemoryRouter>)

    const toggle = await screen.findByRole('checkbox', { name: /use existing cards as context/i })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)

    await waitFor(() => expect(saveMinervaSettings).toHaveBeenCalledWith({ include_card_context: true }))
    expect(toggle).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent(/full card library/i)
  })
})
