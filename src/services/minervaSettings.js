import { API_ENDPOINTS } from '../config/api.js'
import { apiRequest } from './request.js'

export async function getMinervaSettings() {
  const data = await apiRequest(API_ENDPOINTS.MINERVA_SETTINGS, { method: 'GET' })
  return data.settings
}

export async function saveMinervaSettings(settings) {
  const data = await apiRequest(API_ENDPOINTS.MINERVA_SETTINGS, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  return data.settings
}
