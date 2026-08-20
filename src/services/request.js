import { authFetch } from '../config/api.js'

export class ApiError extends Error {
  constructor(message, status, code, metadata = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.provider = metadata.provider
  }
}

export async function apiRequest(path, options = {}) {
  const response = await authFetch(path, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || 'Request failed',
      response.status,
      data.error,
      data,
    )
  }
  return data
}
