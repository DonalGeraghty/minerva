export const API_BASE_URL = (
  import.meta.env?.VITE_JANUS_API_URL
  || 'https://janus-api-schep5xsoq-ew.a.run.app'
).replace(/\/$/, '')

export const API_ENDPOINTS = {
  AUTH_REGISTER: '/api/auth/register',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_ME: '/api/auth/me',
  AUTH_DELETE_ACCOUNT: '/api/auth/account',
  AI_SETTINGS: '/api/user/ai-settings',
  AI_CREDENTIALS: '/api/user/ai-credentials',
  MINERVA_RESPOND: '/api/minerva/respond',
  FLASHCARDS: '/api/flashcards',
  FLASHCARDS_DUE: '/api/flashcards/due',
}

const TOKEN_KEY = 'dg_auth_token'

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Authentication falls back to an anonymous session when storage is blocked.
  }
}

export async function authFetch(path, options = {}) {
  const token = getStoredToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers })
}
