import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  API_BASE_URL,
  API_ENDPOINTS,
  authFetch,
  getStoredToken,
  setStoredToken,
} from '../config/api.js'
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_TOKEN, DEMO_USER } from '../services/demoStore.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    setStoredToken('')
    setUser(null)
  }, [])

  const restoreSession = useCallback(async () => {
    const storedToken = getStoredToken()
    if (import.meta.env.DEV && storedToken === DEMO_TOKEN) {
      setUser(DEMO_USER)
      setLoading(false)
      return
    }
    if (!storedToken) {
      setLoading(false)
      return
    }
    try {
      const response = await authFetch(API_ENDPOINTS.AUTH_ME, { method: 'GET' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.user?.account_id) {
        logout()
        return
      }
      setUser({ email: data.user.email, accountId: data.user.account_id })
    } catch {
      // Keep the stored session so a reload can retry when connectivity returns.
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => { restoreSession() }, [restoreSession])

  const authenticate = useCallback(async (endpoint, email, password) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || data.error || 'Authentication failed')
    if (!data.token || !data.user?.account_id) throw new Error('The account response was incomplete')
    setStoredToken(data.token)
    const nextUser = { email: data.user.email || email, accountId: data.user.account_id }
    setUser(nextUser)
    return nextUser
  }, [])

  const loginAsDemo = useCallback(() => {
    if (!import.meta.env.DEV) throw new Error('The demo account is available only in local development.')
    setStoredToken(DEMO_TOKEN)
    setUser(DEMO_USER)
    return DEMO_USER
  }, [])
  const login = useCallback((email, password) => {
    if (import.meta.env.DEV && email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) return loginAsDemo()
    return authenticate(API_ENDPOINTS.AUTH_LOGIN, email, password)
  }, [authenticate, loginAsDemo])
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
    login,
    loginAsDemo,
    register,
    logout,
    deleteAccount,
  }), [user, loading, login, loginAsDemo, register, logout, deleteAccount])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
