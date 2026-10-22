import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { getGarminSteps } from './services/garmin.js'

const { auth } = vi.hoisted(() => ({ auth: { user: { accountId: 'account-one' }, logout: vi.fn() } }))
vi.mock('./context/AuthContext.jsx', () => ({ useAuth: () => auth }))
vi.mock('./services/garmin.js', async (original) => ({ ...await original(), getGarminSteps: vi.fn(async () => ({ data: [], meta: { source: 'cache', fetched_at: 1, fresh_until: 2 } })) }))
vi.mock('./pages/AccountPage.jsx', () => ({ default: () => <div>Account settings</div> }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('Garmin-only navigation', () => {
  it.each(['/', '/ask', '/flashcards', '/gallery'])('opens the dashboard for %s without study endpoints', async (path) => {
    window.history.replaceState({}, '', path)
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Overview.' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(getGarminSteps).toHaveBeenCalled()
    expect(screen.getByRole('navigation', { name: 'Primary navigation' }).querySelectorAll('a')).toHaveLength(2)
    expect(screen.queryByRole('link', { name: /flashcards|gallery|ask/i })).not.toBeInTheDocument()
  })
})
