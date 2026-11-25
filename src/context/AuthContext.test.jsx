import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import LoginSplash from '../pages/LoginSplash.jsx'
import { BrowserRouter } from 'react-router-dom'

function Session() {
  const { user, loading, sessionError, retrySession } = useAuth()
  if (loading) return <p>Restoring session</p>
  if (sessionError) return <div><p role="alert">{sessionError}</p><button onClick={retrySession}>Retry session</button></div>
  return user ? <p>{user.email} {user.isDemo ? 'demo session' : 'session'}</p> : <LoginSplash />
}

function renderSession() {
  return render(<BrowserRouter><AuthProvider><Session /></AuthProvider></BrowserRouter>)
}

describe('authentication', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('VITE_LOCAL_DEMO', 'true')
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  it('uses a Janus JWT and restores the authenticated demo session', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ token: 'signed-demo-jwt', user: { email: 'demo@minerva.local', account_id: 'synthetic-account', is_demo: true } }) })
    const first = renderSession()
    await userEvent.click(await screen.findByRole('button', { name: /Use demo account/ }))
    expect(await screen.findByText(/demo@minerva.local demo session/)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/login'), expect.objectContaining({ body: JSON.stringify({ email: 'demo@minerva.local', password: 'minerva-demo' }) }))
    expect(localStorage.getItem('dg_auth_token')).toBe('signed-demo-jwt')
    first.unmount()
    renderSession()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/me'), expect.objectContaining({ headers: { Authorization: 'Bearer signed-demo-jwt' } })))
    expect(await screen.findByText(/demo@minerva.local demo session/)).toBeInTheDocument()
  })

  it('keeps the saved token on a temporary failure and can retry restoration', async () => {
    localStorage.setItem('dg_auth_token', 'saved-session-jwt')
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Temporary failure' }) })
    renderSession()
    expect(await screen.findByRole('alert')).toHaveTextContent('saved sign-in')
    expect(localStorage.getItem('dg_auth_token')).toBe('saved-session-jwt')
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: { email: 'owner@example.test', account_id: 'synthetic-account' } }) })
    await userEvent.click(screen.getByRole('button', { name: 'Retry session' }))
    expect(await screen.findByText('owner@example.test session')).toBeInTheDocument()
  })

  it('clears an expired token on a definitive authentication failure', async () => {
    localStorage.setItem('dg_auth_token', 'expired-session-jwt')
    fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) })
    renderSession()
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(localStorage.getItem('dg_auth_token')).toBeNull()
  })
})
