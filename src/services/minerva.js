import { API_ENDPOINTS } from '../config/api.js'
import { apiRequest } from './request.js'

export async function askMinerva(message) {
  const data = await apiRequest(API_ENDPOINTS.MINERVA_RESPOND, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  return data.response
}
