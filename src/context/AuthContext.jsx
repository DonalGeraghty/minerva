import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  API_BASE_URL,
  API_ENDPOINTS,
  authFetch,
  getStoredToken,
  setStoredToken,
} from '../config/api.js'
import { DEMO_EMAIL, DEMO_PASSWORD } from '../services/demoAccount.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const restoreRequest = useRef(null)

  const logout = useCallback(() => {
    restoreRequest.current?.abort()
    setStoredToken('')
    setUser(null)
    setLoading(false)
    setSessionError('')
  }, [])

  const restoreSession = useCallback(async () => {
    restoreRequest.current?.abort()
    const controller = new AbortController()
    restoreRequest.current = controller
    const storedToken = getStoredToken()
    setLoading(true)
    setSessionError('')
    if (!storedToken) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const response = await authFetch(API_ENDPOINTS.AUTH_ME, { method: 'GET', signal: controller.signal })
      const data = await response.json().catch(() => ({}))
      if (controller.signal.aborted || getStoredToken() !== storedToken) return
      if (response.status === 401 || response.status === 403) {
        logout()
        return
      }
      if (!response.ok || !data.user?.account_id) throw new Error('Session restoration unavailable')
      setUser({ email: data.user.email, accountId: data.user.account_id, isDemo: data.user.is_demo === true })
    } catch {
      if (!controller.signal.aborted && getStoredToken() === storedToken) {
        setUser(null)
        setSessionError('Could not restore your session. Your saved sign-in has been kept. Try again.')
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    restoreSession()
    return () => restoreRequest.current?.abort()
  }, [restoreSession])

  const authenticate = useCallback(async (endpoint, email, password) => {
    restoreRequest.current?.abort()
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || data.error || 'Authentication failed')
    if (!data.token || !data.user?.account_id) throw new Error('The account response was incomplete')
    setStoredToken(data.token)
    const nextUser = { email: data.user.email || email, accountId: data.user.account_id, isDemo: data.user.is_demo === true }
    setUser(nextUser)
    setSessionError('')
    setLoading(false)
    return nextUser
  }, [])

  const loginAsDemo = useCallback(() => {
    if (!import.meta.env.DEV || import.meta.env.VITE_LOCAL_DEMO !== 'true') throw new Error('Start npm run dev:demo to use the local demo account.')
    return authenticate(API_ENDPOINTS.AUTH_LOGIN, DEMO_EMAIL, DEMO_PASSWORD)
  }, [authenticate])
  const login = useCallback((email, password) => {
    return authenticate(API_ENDPOINTS.AUTH_LOGIN, email, password)
  }, [authenticate])
  const register = useCallback(
    (email, password) => authenticate(API_ENDPOINTS.AUTH_REGISTER, email, password),
    [authenticate],
  )

  const deleteAccount = useCallback(async (password) => {
    if (user?.isDemo) throw new Error('The local demo account cannot be deleted.')
    const response = await authFetch(API_ENDPOINTS.AUTH_DELETE_ACCOUNT, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || data.error || 'Could not delete account')
    logout()
  }, [logout, user])

  const value = useMemo(() => ({
    user,
    loading,
    sessionError,
    retrySession: restoreSession,
    login,
    loginAsDemo,
    register,
    logout,
    deleteAccount,
  }), [user, loading, sessionError, restoreSession, login, loginAsDemo, register, logout, deleteAccount])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
